import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { fetchConversations, type ConversationListItem } from "@/lib/chat";
import { StoriesStrip } from "@/components/StoriesStrip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/")({
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
      .channel(`conv-list:${user!.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void load(),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  type Filter = "all" | "unread" | "online";
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = items.filter((c) => {
    if (filter === "unread") return c.unread_count > 0;
    if (filter === "online") return c.other_online;
    return true;
  });
  const counts = {
    all: items.length,
    unread: items.filter((c) => c.unread_count > 0).length,
    online: items.filter((c) => c.other_online).length,
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-5 py-4 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
      </header>
      <div className="border-b border-border/40 px-2 py-2">
        <StoriesStrip />
      </div>

      <div className="sticky top-[57px] z-10 flex gap-2 overflow-x-auto border-b border-border/40 bg-background/85 px-3 py-2 backdrop-blur">
        {([
          { id: "all", label: "Toate" },
          { id: "unread", label: "Necitite" },
          { id: "online", label: "Online" },
        ] as Array<{ id: Filter; label: string }>).map((f) => {
          const active = filter === f.id;
          const n = counts[f.id];
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              {n > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                    active ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title={
              items.length === 0
                ? "Nicio conversație încă"
                : filter === "unread"
                  ? "Nicio conversație necitită"
                  : filter === "online"
                    ? "Nimeni online acum"
                    : "Nimic aici"
            }
            body={
              items.length === 0
                ? "Deschide un profil în Discover și apasă Mesaj ca să începi."
                : "Încearcă alt filtru."
            }
          />
        ) : (
          <ul className="space-y-1">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  to="/messages/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="relative">
                    <div
                      className={cn(
                        "size-12 shrink-0 overflow-hidden rounded-full bg-muted",
                        c.unread_count > 0 && "snake-border",
                      )}
                    >
                      {c.other_photo ? (
                        <img
                          src={c.other_photo}
                          alt={c.other_name ?? ""}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                          {(c.other_name ?? "?").slice(0, 1)}
                        </div>
                      )}
                    </div>
                    {c.other_online && (
                      <span
                        aria-label="Online"
                        className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          c.unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {c.other_name ?? "Unknown"}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatWhen(c.last_message_at)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "truncate text-xs",
                        c.unread ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {c.last_message_at ? "Ai un mesaj nou" : "Say hi 👋"}
                    </p>
                  </div>
                  {c.unread_count > 0 ? (
                    <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_0_8px_rgba(244,63,94,0.6)]">
                      {c.unread_count > 99 ? "99+" : c.unread_count}
                    </span>
                  ) : null}
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
