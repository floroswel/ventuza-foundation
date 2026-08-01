import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Flame, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_FILTERS,
  fetchDiscover,
  formatDistance,
  signPhotos,
  type DiscoverProfile,
} from "@/lib/discover";
import { getOrCreateConversation } from "@/lib/chat";
import { setLookingNow } from "@/lib/social";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/cruise")({
  head: () => ({ meta: [{ title: "Cruise · Right Now — Suzeta" }] }),
  component: CruisePage,
});

function CruisePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [myUntil, setMyUntil] = useState<string | null>(null);
  const [busyNow, setBusyNow] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  const loadMine = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("looking_now_until")
      .eq("id", user.id)
      .maybeSingle();
    setMyUntil((data as { looking_now_until?: string | null } | null)?.looking_now_until ?? null);
  }, [user]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  const myActive = !!(myUntil && new Date(myUntil) > new Date());

  async function toggleMine(hours: number) {
    setBusyNow(true);
    try {
      await setLookingNow(hours);
      if (hours > 0) {
        setMyUntil(new Date(Date.now() + hours * 3600_000).toISOString());
        toast.success(`Ești vizibil pe Cruise ${hours}h`);
      } else {
        setMyUntil(null);
        toast.success("Ai ieșit din Cruise");
      }
      void loadMine();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nu am putut schimba starea");
    } finally {
      setBusyNow(false);
    }
  }

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchDiscover(
        { ...DEFAULT_FILTERS, maxDistanceKm: 50, lookingNowOnly: true },
        "distance",
      );
      setProfiles(data);
      const paths = data.map((p) => p.photos?.[0]).filter(Boolean) as string[];
      if (paths.length) signPhotos(paths).then(setUrls);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load Cruise");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime refresh on profile changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`cruise-now:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => void load(),
      )
      .subscribe();
    const t = setInterval(() => load(), 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, [user, load]);

  const maxM = useMemo(() => {
    const ds = profiles.map((p) => p.distance_m ?? 0).filter((d) => d > 0);
    return Math.max(50_000, ...ds);
  }, [profiles]);

  return (
    <main className="relative min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/85 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            to="/discover"
            aria-label="Back"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex-1">
            <h1 className="wordmark text-2xl font-medium leading-none">Cruise</h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-rose-400">
              <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-rose-500 shadow-[0_0_6px_rgb(244,63,94)]" />
              {profiles.length} disponibili acum
            </p>
          </div>
          {myActive ? (
            <button
              type="button"
              disabled={busyNow}
              onClick={() => toggleMine(0)}
              className="rounded-full border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50"
            >
              Ieși din Cruise
            </button>
          ) : (
            <button
              type="button"
              disabled={busyNow}
              onClick={() => toggleMine(2)}
              className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Intră în Cruise
            </button>
          )}
        </div>
        {myActive && myUntil && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Ești vizibil până la{" "}
            {new Date(myUntil).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })} ·
            poți ieși oricând.
          </p>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : profiles.length === 0 ? (
        <EmptyCruise />
      ) : (
        <>
          <Radar
            profiles={profiles}
            maxM={maxM}
            urls={urls}
            onSelect={async (p) => {
              try {
                const cid = await getOrCreateConversation(p.id);
                navigate({ to: "/messages/$id", params: { id: cid } });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Couldn't open chat");
              }
            }}
          />
          <ul className="divide-y divide-border/40">
            {profiles.map((p) => (
              <CruiseRow
                key={p.id}
                p={p}
                url={p.photos?.[0] ? urls[p.photos[0]] : null}
                onMessage={async () => {
                  try {
                    const cid = await getOrCreateConversation(p.id);
                    navigate({ to: "/messages/$id", params: { id: cid } });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Couldn't open chat");
                  }
                }}
              />
            ))}
          </ul>
        </>
      )}

      <BottomNav />
    </main>
  );
}

function Radar({
  profiles,
  maxM,
  urls,
  onSelect,
}: {
  profiles: DiscoverProfile[];
  maxM: number;
  urls: Record<string, string>;
  onSelect: (p: DiscoverProfile) => void;
}) {
  // Place dots on concentric rings; angle is hashed from id for stability
  function angleFor(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return (h % 360) * (Math.PI / 180);
  }
  return (
    <div className="relative mx-auto my-4 aspect-square w-[88%] max-w-sm overflow-hidden rounded-full border border-primary/20 bg-[radial-gradient(circle_at_center,rgba(218,165,32,0.08),transparent_70%)]">
      {[0.33, 0.66, 1].map((r, i) => (
        <span
          key={r}
          className="radar-ring absolute left-1/2 top-1/2 rounded-full border border-primary/25"
          style={{
            width: `${r * 100}%`,
            height: `${r * 100}%`,
            transform: "translate(-50%,-50%)",
            animationDelay: `${i * 0.9}s`,
          }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
      {profiles.slice(0, 24).map((p) => {
        const d = p.distance_m ?? 1000;
        const r = Math.min(0.96, Math.sqrt(d / maxM));
        const a = angleFor(p.id);
        const x = 50 + Math.cos(a) * r * 48;
        const y = 50 + Math.sin(a) * r * 48;
        const url = p.photos?.[0] ? urls[p.photos[0]] : null;
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => onSelect(p)}
            className="absolute size-7 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-rose-400/80 shadow-[0_0_8px_rgba(244,63,94,0.6)] transition-transform active:scale-90 hover:scale-110"
            style={{ left: `${x}%`, top: `${y}%` }}
            title={p.display_name ?? ""}
            aria-label={`Scrie-i lui ${p.display_name ?? "utilizator"}`}
          >
            {url ? (
              <img src={url} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center bg-surface text-[10px] text-muted-foreground">
                {p.display_name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function CruiseRow({
  p,
  url,
  onMessage,
}: {
  p: DiscoverProfile;
  url: string | null;
  onMessage: () => void;
}) {
  const minutesLeft = p.looking_now_until
    ? Math.max(0, Math.round((new Date(p.looking_now_until).getTime() - Date.now()) / 60_000))
    : 0;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="relative block size-12 shrink-0 overflow-hidden rounded-full border border-rose-400/60">
        {url ? (
          <img src={url} alt={p.display_name ?? ""} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-surface text-sm text-muted-foreground">
            {p.display_name?.[0]?.toUpperCase() ?? "?"}
          </span>
        )}
        <span className="absolute bottom-0 right-0 size-3 rounded-full bg-rose-500 ring-2 ring-background" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{p.display_name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          <Flame className="mr-1 inline size-3 text-rose-400" />
          {p.looking_now_intent ?? "Right now"} · {minutesLeft}m rămase ·{" "}
          {formatDistance(p.distance_m)}
        </p>
      </div>
      <button
        onClick={onMessage}
        aria-label="Message"
        className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground glow-gold"
      >
        <MessageCircle className="size-4" />
      </button>
    </li>
  );
}

function EmptyCruise() {
  return (
    <div className="mx-auto max-w-sm px-6 py-20 text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
        <Flame className="size-6" />
      </span>
      <h2 className="font-display text-xl">Nimeni "Right Now" în zonă</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Activează tu Right Now din profil și apari aici pentru ceilalți din zonă.
      </p>
      <Link
        to="/profile"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground glow-gold"
      >
        <Flame className="size-3" /> Activează Right Now
      </Link>
    </div>
  );
}
