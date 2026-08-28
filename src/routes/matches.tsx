import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Hand, Heart, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicProfiles, getOrCreateConversation, type PublicProfileMini } from "@/lib/chat";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { PresenceDot } from "@/components/PresenceDot";
import { cn } from "@/lib/utils";
import { withGuardian } from "@/components/with-guardian";
import { safeFormat } from "@/lib/safe-locale";
import { dayKey } from "@/components/ui-kit/DaySeparator";

export const Route = createFileRoute("/matches")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Potriviri — Suzeta" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Potrivirile tale, vizitele pe profil, tap-urile primite și favoriții — într-un singur loc." },
    ],
  }),
  component: withGuardian("matching", MatchesPage, "matching"),
});

type TabKey = "matches" | "visits" | "taps" | "favorites";

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Heart }> = [
  { key: "matches", label: "Potriviri", Icon: Heart },
  { key: "visits", label: "Vizite", Icon: Eye },
  { key: "taps", label: "Tap-uri", Icon: Hand },
  { key: "favorites", label: "Favoriți", Icon: Star },
];

type PersonRow = {
  key: string;
  other_id: string;
  at: string;
  note?: string | null;
  profile: PublicProfileMini | null;
};

const EMPTY: Record<TabKey, { title: string; body: string }> = {
  matches: {
    title: "Încă niciun match",
    body: "Când tu și altcineva vă apreciați reciproc, apar aici.",
  },
  visits: {
    title: "Nimeni nu ți-a vizitat profilul încă",
    body: "Adaugă o poză clară și o descriere scurtă — profilurile complete primesc mult mai multe vizite.",
  },
  taps: {
    title: "Niciun tap primit",
    body: "Trimite tu primul tap din Descoperă; de obicei se răspunde la fel.",
  },
  favorites: {
    title: "Nicio persoană salvată",
    body: "Apasă ⭐ pe un profil ca să-l ai mereu la îndemână aici.",
  },
};

/**
 * Timp cu ORA vizibilă: relativ pentru azi/ieri, dată + oră pentru mai vechi.
 * „acum 12 min”, „acum 2 ore”, „ieri, 21:40”, „04.08.2026, 18:12”.
 */
function timeAgo(iso: string) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const diff = Date.now() - then.getTime();
  const m = 60_000;
  const h = 60 * m;
  const hhmm = safeFormat(then, { hour: "2-digit", minute: "2-digit" }, "time");
  if (diff < h) return `acum ${Math.max(1, Math.floor(diff / m))} min`;
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 24 * h).toISOString());
  const key = dayKey(iso);
  if (key === today) {
    const hours = Math.floor(diff / h);
    return hours <= 1 ? `acum o oră · ${hhmm}` : `acum ${hours} ore · ${hhmm}`;
  }
  if (key === yesterday) return `ieri, ${hhmm}`;
  return `${safeFormat(then, { day: "2-digit", month: "2-digit", year: "numeric" }, "date")}, ${hhmm}`;
}

/** Marcaj local „ce am văzut deja” per tab — nu are nevoie de backend. */
function seenKey(uid: string, tab: TabKey) {
  return `vz_matches_seen:${uid}:${tab}`;
}

function readSeen(uid: string, tab: TabKey): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(seenKey(uid, tab)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeSeen(uid: string, tab: TabKey, at: number) {
  try {
    window.localStorage.setItem(seenKey(uid, tab), String(at));
  } catch {
    /* private mode */
  }
}

function MatchesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("matches");
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  // Praguri „văzut până la” per tab (timestamp ms), citite din localStorage.
  const [seenAt, setSeenAt] = useState<Record<TabKey, number>>({
    matches: 0,
    visits: 0,
    taps: 0,
    favorites: 0,
  });
  // Contoare de intrări noi per tab, calculate la încărcarea fiecărui tab.
  const [newCounts, setNewCounts] = useState<Record<TabKey, number>>({
    matches: 0,
    visits: 0,
    taps: 0,
    favorites: 0,
  });

  useEffect(() => {
    if (!user) return;
    setSeenAt({
      matches: readSeen(user.id, "matches"),
      visits: readSeen(user.id, "visits"),
      taps: readSeen(user.id, "taps"),
      favorites: readSeen(user.id, "favorites"),
    });
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  const loadTab = useCallback(
    async (which: TabKey, uid: string): Promise<PersonRow[]> => {
      if (which === "matches") {
        const { data, error } = await supabase
          .from("matches")
          .select("id, user_a, user_b, created_at")
          .or(`user_a.eq.${uid},user_b.eq.${uid}`)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return (data ?? []).map((m) => ({
          key: m.id as string,
          other_id: (m.user_a === uid ? m.user_b : m.user_a) as string,
          at: m.created_at as string,
          profile: null,
        }));
      }

      if (which === "visits") {
        const { data, error } = await supabase
          .from("profile_views")
          .select("viewer_id, viewed_at")
          .eq("viewed_id", uid)
          .order("viewed_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        const seen = new Set<string>();
        const out: PersonRow[] = [];
        for (const r of (data ?? []) as Array<{ viewer_id: string; viewed_at: string }>) {
          if (r.viewer_id === uid || seen.has(r.viewer_id)) continue;
          seen.add(r.viewer_id);
          out.push({ key: r.viewer_id, other_id: r.viewer_id, at: r.viewed_at, profile: null });
        }
        return out;
      }

      if (which === "taps") {
        const [taps, woofs] = await Promise.all([
          supabase
            .from("taps")
            .select("id, sender_id, emoji, created_at")
            .eq("receiver_id", uid)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("woofs")
            .select("id, sender_id, created_at")
            .eq("receiver_id", uid)
            .order("created_at", { ascending: false })
            .limit(200),
        ]);
        if (taps.error) throw taps.error;
        const merged: PersonRow[] = [
          ...(taps.data ?? []).map((t) => ({
            key: `t-${t.id as string}`,
            other_id: t.sender_id as string,
            at: t.created_at as string,
            note: (t as { emoji?: string | null }).emoji ?? "👋",
            profile: null,
          })),
          ...(woofs.error ? [] : (woofs.data ?? [])).map((w) => ({
            key: `w-${w.id as string}`,
            other_id: w.sender_id as string,
            at: w.created_at as string,
            note: "🐺",
            profile: null,
          })),
        ].sort((a, b) => (a.at < b.at ? 1 : -1));
        const seen = new Set<string>();
        return merged.filter((r) => (seen.has(r.other_id) ? false : (seen.add(r.other_id), true)));
      }

      const { data, error } = await supabase
        .from("favorites")
        .select("favorite_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((f) => ({
        key: f.favorite_id as string,
        other_id: f.favorite_id as string,
        at: f.created_at as string,
        profile: null,
      }));
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const base = await loadTab(tab, user.id);
        const profiles = await fetchPublicProfiles(
          Array.from(new Set(base.map((r) => r.other_id))),
        );
        // Profilurile invizibile (blocate / șterse / incognito) nu apar deloc.
        const enriched = base
          .map((r) => ({ ...r, profile: profiles.get(r.other_id) ?? null }))
          .filter((r) => r.profile);
        if (alive) setRows(enriched);
      } catch (e) {
        if (alive) {
          setRows([]);
          toast.error((e as Error).message);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, tab, loadTab]);

  async function openChat(otherId: string) {
    if (opening) return;
    setOpening(otherId);
    try {
      const convId = await getOrCreateConversation(otherId);
      navigate({ to: "/messages/$id", params: { id: convId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(null);
    }
  }

  const empty = useMemo(() => EMPTY[tab], [tab]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-nav">
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-background/85 pt-safe backdrop-blur">
        <h1 className="px-5 py-3 text-center font-serif text-2xl tracking-wide text-primary">
          Potriviri
        </h1>
        <div
          role="tablist"
          aria-label="Filtre potriviri"
          className="flex items-stretch gap-1 px-3 pb-2"
        >
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={TABS.find((t) => t.key === tab)!.Icon} title={empty.title} body={empty.body} />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {rows.map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  onClick={() => void openChat(m.other_id)}
                  disabled={opening === m.other_id}
                  className={cn(
                    "group relative flex aspect-[3/4] w-full flex-col justify-end overflow-hidden rounded-2xl border border-primary/25 bg-surface text-left shadow-sm transition-transform",
                    "hover:-translate-y-0.5 hover:shadow-[0_0_20px_hsl(var(--primary)/0.25)]",
                  )}
                >
                  {m.profile?.photo ? (
                    <img
                      src={m.profile.photo}
                      alt={m.profile?.name ?? ""}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-4xl text-muted-foreground/60">
                      {m.profile?.discreetAvatar ?? (m.profile?.name ?? "?").slice(0, 1)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  {m.note && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-sm backdrop-blur">
                      {m.note}
                    </span>
                  )}
                  <div className="relative z-10 flex items-end justify-between p-3">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base text-primary">
                        {m.profile?.name ?? "—"}
                      </p>
                      <p className="text-[11px] text-white/70">{timeAgo(m.at)}</p>
                    </div>
                    <PresenceDot
                      online={!!m.profile?.online}
                      traveler={!!m.profile?.traveler}
                      className="size-2.5"
                    />
                  </div>
                  {opening === m.other_id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
