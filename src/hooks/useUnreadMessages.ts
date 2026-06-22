import { useEffect, useSyncExternalStore, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type UnreadState = {
  total: number;
  bySender: Record<string, number>;
  byConversation: Record<string, number>;
};

const EMPTY: UnreadState = { total: 0, bySender: {}, byConversation: {} };

// Singleton store — shared by all hook consumers, single realtime channel.
let state: UnreadState = EMPTY;
let currentUserId: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function doRefresh(userId: string) {
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (!convs?.length) {
    state = EMPTY;
    emit();
    return;
  }
  const convIds = convs.map((c) => c.id);
  const { data: unread } = await supabase
    .from("messages")
    .select("conversation_id, sender_id")
    .in("conversation_id", convIds)
    .neq("sender_id", userId)
    .is("read_at", null);
  const bySender: Record<string, number> = {};
  const byConversation: Record<string, number> = {};
  for (const m of (unread ?? []) as Array<{ conversation_id: string; sender_id: string }>) {
    bySender[m.sender_id] = (bySender[m.sender_id] ?? 0) + 1;
    byConversation[m.conversation_id] = (byConversation[m.conversation_id] ?? 0) + 1;
  }
  state = { total: unread?.length ?? 0, bySender, byConversation };
  emit();
}

function scheduleRefresh(userId: string) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (inflight) return;
    inflight = doRefresh(userId).finally(() => { inflight = null; });
  }, 250);
}

function ensureChannel(userId: string) {
  if (currentUserId === userId && channel) return;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  currentUserId = userId;
  channel = supabase
    .channel(`unread-msgs-${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => scheduleRefresh(userId))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => scheduleRefresh(userId))
    .subscribe();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() { return state; }

export function useUnreadMessages() {
  const { user } = useAuth();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!user) {
      if (channel) { supabase.removeChannel(channel); channel = null; currentUserId = null; }
      if (state !== EMPTY) { state = EMPTY; emit(); }
      return;
    }
    ensureChannel(user.id);
    void doRefresh(user.id);
  }, [user]);

  const refresh = useCallback(async () => {
    if (user) await doRefresh(user.id);
  }, [user]);

  return { ...snap, refresh };
}
