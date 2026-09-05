import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CalendarHeart,
  ChevronLeft,
  Eye,
  Hand,
  Heart,
  Loader2,
  Lock,
  Megaphone,
  MessageCircle,
  Star,

  Trash2,
  Unlock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { signPhotos } from "@/lib/discover";
import type { NotificationType } from "@/lib/notifications";

/** Avatarul celui care a declanșat notificarea (Like, tap, vizită…). */
type Actor = { display_name: string | null; photo: string | null; profile_slug: string | null };

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Suzeta" }] }),
  component: NotificationsPage,
});

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  match: Heart,
  message: MessageCircle,
  profile_view: Eye,
  album_request: Lock,
  album_granted: Unlock,
  event_rsvp: CalendarHeart,
  event_reminder: CalendarHeart,
  tap: Hand,
  like: Heart,
  favorite: Star,
  admin_message: Bell,
  partner_broadcast: Megaphone,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = 60_000,
    h = 60 * m,
    day = 24 * h;
  if (diff < m) return "now";
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < day) return `${Math.floor(diff / h)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return new Date(iso).toLocaleDateString();
}

function NotificationsPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { notifications, loading, markAllRead, markRead, remove } = useNotifications();

  // Avatarele actorilor. RLS pe `profiles` nu permite citirea altor profiluri,
  // deci trecem prin RPC-ul `get_notification_actors`, care aplică aceleași
  // garduri ca /u/:slug (șters, banat, suspendat, block bilateral). Un actor
  // blocat pur și simplu lipsește din răspuns → rândul rămâne cu iconița.
  const actorIds = useMemo(
    () => [...new Set(notifications.map((n) => n.actor_id).filter((v): v is string => !!v))].sort(),
    [notifications],
  );
  const [actors, setActors] = useState<Record<string, Actor>>({});

  useEffect(() => {
    if (actorIds.length === 0) {
      setActors({});
      return;
    }
    let cancelled = false;
    void (async () => {
      // `as never`: RPC adăugat de migrarea 20260807210000, încă absent din
      // tipurile generate din DB (vezi și src/lib/chat.ts).
      const { data, error } = await supabase.rpc("get_notification_actors" as never, {
        _ids: actorIds,
      } as never);
      if (error || !data || cancelled) return;
      const rows = data as unknown as Array<{ id: string } & Actor>;
      const paths = rows.map((r) => r.photo).filter((p): p is string => !!p);
      const signed = paths.length ? await signPhotos(paths) : {};
      if (cancelled) return;
      setActors(
        Object.fromEntries(
          rows.map((r) => [
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

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-nav">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-3 py-3 backdrop-blur">
        <Link
          to="/discover"
          className="rounded-full p-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{t("notif.title")}</h1>
        <button
          onClick={() => markAllRead()}
          className="ml-auto rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("notif.markAllRead")}
        </button>
      </header>

      <div className="flex-1 px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
            <Bell className="size-10 text-primary/60" />
            <p className="mt-3 text-sm">{t("notif.emptyTitle")}</p>
            <p className="text-xs">{t("notif.emptyDesc")}</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {notifications.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const actor = n.actor_id ? actors[n.actor_id] : undefined;
              const Wrapper: React.ElementType = n.link ? Link : "div";
              const wrapperProps = n.link ? { to: n.link } : {};
              return (
                <li
                  key={n.id}
                  className={`group flex items-start gap-3 rounded-xl px-3 py-3 ${n.read_at ? "" : "bg-primary/5"}`}
                >
                  <Wrapper
                    {...wrapperProps}
                    onClick={() => !n.read_at && markRead([n.id])}
                    className="flex flex-1 items-start gap-3"
                  >
                    <div
                      className={`relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full ${n.read_at ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}
                    >
                      {actor?.photo ? (
                        <img
                          src={actor.photo}
                          alt={actor.display_name ?? ""}
                          className="size-full object-cover"
                        />
                      ) : actor?.display_name ? (
                        <span className="text-sm font-semibold">
                          {actor.display_name[0]?.toUpperCase()}
                        </span>
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-foreground">{n.title}</p>
                      {n.body && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.read_at && (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </Wrapper>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(n.id);
                    }}
                    className="shrink-0 rounded-full p-2 text-muted-foreground transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
