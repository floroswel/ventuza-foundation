import { safeFormat, safeLocale } from "@/lib/safe-locale";
import { ConversationListSkeleton } from "@/components/skeletons/FirstScreenSkeletons";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Sparkles, SquarePen } from "lucide-react";
import { useNotifications } from "@/lib/notifications-context";
import { signPhotos } from "@/lib/discover";

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
import { StoriesStrip } from "@/components/StoriesStrip";
import { cn } from "@/lib/utils";
import { OnlineIndicator } from "@/components/ui-kit/OnlineIndicator";
import { UnreadBadge } from "@/components/ui-kit/UnreadBadge";
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
  const [tab, setTab] = useState<"messages" | "interest">("messages");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Sursa unică — se hidratează la login și se actualizează în realtime la
  // schimbarea toggle-ului din Settings (fără refresh).
  // Inbox-ul este o suprafață autentificată, deja deschisă intenționat de user.
  // `show_preview` rămâne exclusiv pentru notificări/toast-uri care pot apărea
  // pe lock-screen; nu ascundem conținutul în propria listă de conversații.
  const showPreview = true;


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

  const DAY_MS = 24 * 60 * 60 * 1000;
  const visible = items.filter((c) => {
    if (unreadOnly && !c.unread) return false;
    if (onlineOnly && !c.other_online) return false;
    if (recentOnly) {
      const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
      if (!t || Date.now() - t > DAY_MS) return false;
    }
    return true;
  });
  const unreadTotal = items.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-nav">
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/85 px-4 pt-2 backdrop-blur">
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

        <div className="mt-1.5 flex items-center gap-5">
          <TabButton active={tab === "messages"} onClick={() => setTab("messages")}>
            Mesaje
          </TabButton>
          <TabButton active={tab === "interest"} onClick={() => setTab("interest")}>
            Interes
          </TabButton>
        </div>

        {tab === "messages" ? (
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>
              Necitite
              {unreadTotal > 0 ? (
                <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                  {unreadTotal > 99 ? "99+" : unreadTotal}
                </span>
              ) : null}
            </FilterChip>
            <FilterChip active={onlineOnly} onClick={() => setOnlineOnly((v) => !v)}>
              Online
            </FilterChip>
            <FilterChip active={recentOnly} onClick={() => setRecentOnly((v) => !v)}>
              Recente
            </FilterChip>
          </div>
        ) : (
          <div className="pb-1.5" />
        )}
      </header>

      {tab === "interest" ? (
        <div className="flex-1">
          <InterestTab />
          <BottomNav />
        </div>
      ) : (
        <>
      <StoriesStrip />

      <div className="flex-1 px-2 pb-2 pt-1">



        {loading ? (
          <ConversationListSkeleton />
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
        ) : visible.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Nicio conversație încă"
            body="Deschide un profil în Discover și apasă Mesaj ca să începi."
          />
        ) : (
          <ul className="space-y-0.5 px-1">
            {visible.map((c) => (
              <li key={c.id}>
                <Link
                  to="/messages/$id"
                  params={{ id: c.id }}
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl py-2.5 pl-3 pr-3 transition-colors active:bg-muted/50 hover:bg-muted/30",
                    c.unread && "bg-primary/[0.06]",
                  )}
                >
                  {c.unread ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                    />
                  ) : null}
                  {/* Avatar pătrat rotunjit — layout de aplicație, nu de site */}
                  <div className="relative shrink-0">
                    <div className="size-[52px] overflow-hidden rounded-2xl bg-surface ring-1 ring-border/60">
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
                      <OnlineIndicator
                        online
                        size="md"
                        ring
                        className="absolute -bottom-0.5 -right-0.5"
                      />
                    )}
                  </div>

                  {/* Corp — nume+oră pe rândul 1, preview+badge pe rândul 2 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate text-[15px] leading-tight text-foreground",
                          c.unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {c.other_name ?? "Utilizator Suzeta"}
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
                      <UnreadBadge count={c.unread_count} className="shrink-0" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
        </>
      )}
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative pb-2 text-[15px] font-semibold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-primary" />
      ) : null}
    </button>
  );
}

type InterestActor = { display_name: string | null; photo: string | null; profile_slug: string | null };

const INTEREST_KINDS = new Set(["tap", "like", "favorite", "profile_view", "match"]);

const INTEREST_LABEL: Record<string, string> = {
  tap: "Ți-a dat tap",
  like: "Te-a plăcut",
  favorite: "Te-a adăugat la favorite",
  profile_view: "Ți-a văzut profilul",
  match: "Match nou",
};

/** Tab „Interes" — cine a interacționat cu tine (tap / like / favorite / vizite). */
function InterestTab() {
  const { notifications, loading } = useNotifications();
  const rows = useMemo(
    () => notifications.filter((n) => INTEREST_KINDS.has(n.type as string)).slice(0, 60),
    [notifications],
  );
  const actorIds = useMemo(
    () => [...new Set(rows.map((n) => n.actor_id).filter((v): v is string => !!v))].sort(),
    [rows],
  );
  const [actors, setActors] = useState<Record<string, InterestActor>>({});

  useEffect(() => {
    if (actorIds.length === 0) {
      setActors({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("get_notification_actors" as never, {
        _ids: actorIds,
      } as never);
      if (error || !data || cancelled) return;
      const list = data as unknown as Array<{ id: string } & InterestActor>;
      const paths = list.map((r) => r.photo).filter((p): p is string => !!p);
      const signed = paths.length ? await signPhotos(paths) : {};
      if (cancelled) return;
      setActors(
        Object.fromEntries(
          list.map((r) => [
            r.id,
            {
              display_name: r.display_name,
              photo: r.photo ? (signed[r.photo] ?? null) : null,
              profile_slug: r.profile_slug,
            },
          ]),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [actorIds]);

  if (loading) {
    return <ConversationListSkeleton count={5} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Niciun interes încă"
        body="Când cineva îți dă tap, like sau te adaugă la favorite, apare aici."
      />
    );
  }

  return (
    <ul className="divide-y divide-border/30 px-2 py-2">
      {rows.map((n) => {
        const actor = n.actor_id ? actors[n.actor_id] : undefined;
        const name = actor?.display_name ?? "Cineva";
        const body = (
          <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/30">
            <div className="size-14 shrink-0 overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
              {actor?.photo ? (
                <img src={actor.photo} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                  {name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{name}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {INTEREST_LABEL[n.type as string] ?? "Interacțiune nouă"}
              </p>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatWhen(n.created_at)}
            </span>
          </div>
        );
        return (
          <li key={n.id}>
            {actor?.profile_slug ? (
              <Link to="/u/$slug" params={{ slug: actor.profile_slug }}>
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
