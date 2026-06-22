import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type UnreadState = {
  total: number;
  bySender: Record<string, number>;
  byConversation: Record<string, number>;
};

const EMPTY: UnreadState = { total: 0, bySender: {}, byConversation: {} };

/**
 * Tracks unread 1:1 messages for the current user.
 * - `total`: total unread count
 * - `bySender`: unread count keyed by the sender's user id (useful for grid badges)
 * - `byConversation`: unread count keyed by conversation id
 */
export function useUnreadMessages() {
  const { user } = useAuth();
  const [state, setState] = useState<UnreadState>(EMPTY);

  const refresh = useCallback(async () => {
    if (!user) {
      setState(EMPTY);
      return;
    }
    // Get my conversations
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, user_a, user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    if (!convs?.length) {
      setState(EMPTY);
      return;
    }
    const convIds = convs.map((c) => c.id);
    const otherByConv = new Map<string, string>();
    for (const c of convs) {
      otherByConv.set(c.id, c.user_a === user.id ? c.user_b : c.user_a);
    }
    const { data: unread } = await supabase
      .from("messages")
      .select("conversation_id, sender_id")
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .is("read_at", null);
    const bySender: Record<string, number> = {};
    const byConversation: Record<string, number> = {};
    for (const m of (unread ?? []) as Array<{ conversation_id: string; sender_id: string }>) {
      bySender[m.sender_id] = (bySender[m.sender_id] ?? 0) + 1;
      byConversation[m.conversation_id] = (byConversation[m.conversation_id] ?? 0) + 1;
    }
    setState({ total: unread?.length ?? 0, bySender, byConversation });
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`unread-msgs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => { void refresh(); },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  return { ...state, refresh };
}
