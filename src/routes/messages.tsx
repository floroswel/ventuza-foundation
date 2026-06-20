import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { fetchConversations, type ConversationListItem } from "@/lib/chat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — Ventuza" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    async function load() {
      try {
        const data = await fetchConversations(user!.id);
        if (alive) setItems(data);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    const ch = supabase
      .channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void load())
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-5 py-4 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
      </header>

      <div className="flex-1 px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
            <MessageCircle className="size-10 text-primary/60" />
            <p className="mt-3 text-sm">No conversations yet.</p>
            <p className="text-xs">Open a profile in Discover and tap Message.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  to="/messages/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-full bg-muted">
                    {c.other_photo ? (
                      <img src={c.other_photo} alt={c.other_name ?? ""} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                        {(c.other_name ?? "?").slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>
                        {c.other_name ?? "Unknown"}
                      </p>
                      <span className="text-[10px] text-muted-foreground">{formatWhen(c.last_message_at)}</span>
                    </div>
                    <p
                      className={cn(
                        "truncate text-xs",
                        c.unread ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {c.last_message_preview ?? "Say hi 👋"}
                    </p>
                  </div>
                  {c.unread ? <span className="size-2 rounded-full bg-primary" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < hr) return `${Math.max(1, Math.floor(diff / min))}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return d.toLocaleDateString();
}
