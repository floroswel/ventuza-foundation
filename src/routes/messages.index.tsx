import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Crown, SquarePen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { fetchConversations, type ConversationListItem } from "@/lib/chat";
import { StoriesStrip } from "@/components/StoriesStrip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "Mesaje — Ventuza" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const p = (data as { notification_prefs?: { show_preview?: boolean } } | null)
          ?.notification_prefs;
        setShowPreview(p?.show_preview === true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

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

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-24">
      <header className="sticky top-0 z-20 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/40 bg-background/85 px-5 py-4 backdrop-blur">
        <Crown className="size-6 text-primary" aria-hidden />
        <h1 className="text-center font-serif text-2xl tracking-wide text-primary">
          Mesaje
        </h1>
        <button
          type="button"
          onClick={() => navigate({ to: "/discover" })}
          aria-label="Conversație nouă"
          className="text-primary/90 transition-colors hover:text-primary"
        >
          <SquarePen className="size-5" />
        </button>
      </header>

      <StoriesStrip />

      <div className="flex-1 px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Nicio conversație încă"
            body="Deschide un profil în Discover și apasă Mesaj ca să începi."
          />
        ) : (
          <ul className="divide-y divide-border/30">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  to="/messages/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="relative shrink-0">
                    <span
                      className={cn(
                        "block size-14 rounded-full p-[2px]",
                        "bg-gradient-to-tr from-primary/70 via-primary to-primary/70",
                      )}
                    >
                      <span className="block size-full overflow-hidden rounded-full bg-surface ring-2 ring-background">
                        {c.other_photo ? (
                          <img
                            src={c.other_photo}
                            alt={c.other_name ?? ""}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-sm text-muted-foreground">
                            {(c.other_name ?? "?").slice(0, 1)}
                          </span>
                        )}
                      </span>
                    </span>
                    {c.other_online && (
                      <span
                        aria-label="Online"
                        className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate font-serif text-lg leading-tight text-primary",
                        c.unread ? "font-semibold" : "font-medium",
                      )}
                    >
                      {c.other_name ?? "Unknown"}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-sm",
                        c.unread ? "text-foreground/90" : "text-muted-foreground",
                      )}
                    >
                      {showPreview
                        ? (c.last_message_preview ?? "Say hi 👋")
                        : c.last_message_at
                          ? "Ai un mesaj nou"
                          : "Say hi 👋"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {formatWhen(c.last_message_at)}
                    </span>
                    {c.unread_count > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
                        {c.unread_count > 99 ? "99+" : c.unread_count}
                      </span>
                    ) : null}
                  </div>
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
  const now = new Date();
  const diff = Math.max(0, now.getTime() - d.getTime());
  const day = 24 * 60 * 60 * 1000;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) {
    return d.toLocaleDateString([], { weekday: "long" });
  }
  return d.toLocaleDateString();
}
