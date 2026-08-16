import { safeFormat, safeLocale } from "@/lib/safe-locale";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Crown, SquarePen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  fetchConversations,
  normalizeConversationList,
  type ConversationListItem,
} from "@/lib/chat";
import { buildInboxPreview } from "@/lib/notification-privacy";
import { useNotificationPrefs } from "@/lib/notification-prefs-context";
import { StoriesStrip } from "@/components/StoriesStrip";
import { cn } from "@/lib/utils";
import { subscribeConversationChanges } from "@/hooks/useUnreadMessages";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "Mesaje — Suzeta" }] }),
  errorComponent: MessagesRouteError,
  component: MessagesPage,
});

function MessagesRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    console.error("[messages] route render failed", error);
    void import("@/lib/crash-log").then(({ logCrash }) =>
      logCrash({
        kind: "boundary",
        boundary: "messages_index",
        message: error.message,
        stack: error.stack,
      }),
    );
  }, [error]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-background px-6 text-center">
      <MessageCircle className="size-10 text-primary" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold text-foreground">Mesajele se reîncarcă</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Am prins eroarea local, fără să mai cadă toată aplicația.
      </p>
      <p className="sr-only">{error.message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          onClick={() => {
            queryClient.removeQueries({ queryKey: ["conversations"] });
            router.invalidate();
            reset();
          }}
        >
          Reîncearcă
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.assign("/auth?mode=login")}>
          Login
        </Button>
      </div>
    </div>
  );
}

function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Sursa unică — se hidratează la login și se actualizează în realtime la
  // schimbarea toggle-ului din Settings (fără refresh).
  const { prefs } = useNotificationPrefs();
  const showPreview = prefs.show_preview;

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  // Key ["conversations", userId] este în allowlist-ul persister-ului
  // (src/lib/query-persister.ts) → apare offline la re-open fără net.
  const conversationsQuery = useQuery({
    queryKey: ["conversations", user?.id ?? "anon"],
    queryFn: () => (user ? fetchConversations(user.id) : Promise.resolve<ConversationListItem[]>([])),
    enabled: !!user,
    staleTime: 30_000,
    select: normalizeConversationList,
  });

  // Cache-ul offline poate proveni dintr-o versiune veche. Nu permitem unui
  // payload invalid să ajungă la `.map()` și să dărâme ruta.
  const items = normalizeConversationList(conversationsQuery.data);
  const loading = conversationsQuery.isLoading;
  const loadError = conversationsQuery.error;

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    // BottomNav deține unicul canal Realtime `conv-list:<uid>`. Pagina
    // ascultă evenimentele lui, fără să creeze încă un canal cu același topic.
    return subscribeConversationChanges(invalidate);
  }, [user?.id, queryClient]);



  if (authLoading || !user) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center bg-background px-6 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-label="Se verifică sesiunea" />
      </div>
    );
  }

  const visible = items.filter(
    (c) => (!unreadOnly || c.unread) && (!onlineOnly || c.other_online),
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-nav">
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/85 px-4 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Inbox</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/discover" })}
            aria-label="Conversație nouă"
            className="text-primary/90 transition-colors hover:text-primary"
          >
            <SquarePen className="size-5" />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip active={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>
            Necitite
          </FilterChip>
          <FilterChip active={onlineOnly} onClick={() => setOnlineOnly((v) => !v)}>
            Online
          </FilterChip>
        </div>
      </header>

      <StoriesStrip />

      <div className="flex-1 px-2 py-2">

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="mx-4 my-8 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-5 text-center">
            <p className="text-sm font-medium text-foreground">Conversațiile nu s-au putut încărca.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Conexiunea sau sesiunea poate fi temporar indisponibilă.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void conversationsQuery.refetch()}
            >
              Reîncearcă
            </Button>
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
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/30"
                >
                  {/* Avatar — mereu în stânga, cu inel auriu */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "size-14 rounded-full p-[2px]",
                        "bg-gradient-to-tr from-primary/70 via-primary to-primary/70",
                      )}
                    >
                      <div className="size-full overflow-hidden rounded-full bg-surface ring-2 ring-background">
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
                    </div>
                    {c.other_online && (
                      <span
                        aria-label="Online"
                        className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                      />
                    )}
                  </div>

                  {/* Corp — nume+oră pe rândul 1, preview+badge pe rândul 2 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate font-serif text-lg leading-tight text-primary",
                          c.unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {c.other_name ?? "Unknown"}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] tabular-nums",
                          c.unread ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                          {formatWhen(c.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          c.unread ? "text-foreground/90" : "text-muted-foreground",
                        )}
                      >
                        {buildInboxPreview(showPreview, c.last_message_preview, !!c.last_message_at)}
                      </p>
                      {c.unread_count > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      ) : null}
                    </div>
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

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.max(0, now.getTime() - d.getTime());
  const day = 24 * 60 * 60 * 1000;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const locale = safeLocale();
  if (sameDay) {
    return safeFormat(d, { hour: "2-digit", minute: "2-digit" }, "time");
  }
  if (diff < 2 * day) return locale.startsWith("ro") ? "Ieri" : "Yesterday";
  if (diff < 7 * day) {
    return safeFormat(d, { weekday: "long" }, "date");
  }
  return safeFormat(d, {}, "date");

}
