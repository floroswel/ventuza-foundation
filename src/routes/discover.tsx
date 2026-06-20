import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { Compass, Grid3x3, Loader2, MapPin, SlidersHorizontal, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { SwipeCard, SwipeActions } from "@/components/SwipeCard";
import { FiltersDrawer } from "@/components/FiltersDrawer";
import { MatchModal } from "@/components/MatchModal";
import {
  DEFAULT_FILTERS, fetchDiscover, requestAndStoreLocation,
  signPhotos, formatDistance, ageFrom, isOnline,
  type DiscoverFilters, type DiscoverProfile,
} from "@/lib/discover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/discover")({
  head: () => ({ meta: [{ title: "Discover — Ventuza" }] }),
  component: DiscoverPage,
});

type Mode = "swipe" | "grid";

function DiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("swipe");
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locStatus, setLocStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [match, setMatch] = useState<{ name: string; photo: string | null } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  // touch last_seen on mount
  useEffect(() => {
    if (user) supabase.rpc("touch_last_seen");
  }, [user]);

  // Request location once
  useEffect(() => {
    if (!user || locStatus !== "unknown") return;
    requestAndStoreLocation().then((r) => {
      setLocStatus(r.ok ? "granted" : "denied");
      if (!r.ok) toast.message("Location unavailable", { description: "We'll still show people based on your filters." });
    });
  }, [user, locStatus]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchDiscover(filters, mode === "swipe" ? "score" : "distance");
      setProfiles(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load discover");
    } finally {
      setLoading(false);
    }
  }, [filters, mode, user]);

  useEffect(() => { void load(); }, [load]);

  const handleDecision = useCallback(async (target: DiscoverProfile, action: "like" | "pass" | "super") => {
    if (!user) return;
    // optimistic removal
    setProfiles((p) => p.filter((x) => x.id !== target.id));

    const { error } = await supabase.from("swipes").insert({
      swiper_id: user.id,
      target_id: target.id,
      action,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (action === "like" || action === "super") {
      const { data: m } = await supabase
        .from("matches")
        .select("id")
        .or(`and(user_a.eq.${user.id},user_b.eq.${target.id}),and(user_a.eq.${target.id},user_b.eq.${user.id})`)
        .maybeSingle();
      if (m) {
        const photoPath = target.photos?.[0];
        const signed = photoPath ? (await signPhotos([photoPath]))[photoPath] : null;
        setMatch({ name: target.display_name ?? "Someone wonderful", photo: signed ?? null });
      }
    }
  }, [user]);

  return (
    <main className="relative min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/80 px-5 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="wordmark text-2xl font-medium">Discover</h1>
          <button
            onClick={() => setFiltersOpen(true)}
            aria-label="Filters"
            className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-primary hover:bg-primary/10"
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </div>

        <div className="mt-3 inline-flex w-full rounded-full border border-border bg-surface p-1">
          <ModeBtn active={mode === "swipe"} onClick={() => setMode("swipe")} icon={<Sparkles className="size-4" />} label="Curated" />
          <ModeBtn active={mode === "grid"} onClick={() => setMode("grid")} icon={<Grid3x3 className="size-4" />} label="Nearby" />
        </div>
      </header>

      {loading ? (
        <CenterMessage icon={<Loader2 className="size-6 animate-spin text-primary" />} title="Finding people…" />
      ) : profiles.length === 0 ? (
        <EmptyState onRefresh={() => load()} hasLocation={locStatus === "granted"} />
      ) : mode === "swipe" ? (
        <SwipeStack profiles={profiles} onDecision={handleDecision} />
      ) : (
        <GridView profiles={profiles} />
      )}

      <FiltersDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filters} onApply={setFilters} />
      <MatchModal open={!!match} onClose={() => setMatch(null)} otherName={match?.name ?? ""} otherPhotoUrl={match?.photo ?? null} />
      <BottomNav />
    </main>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all",
        active ? "bg-primary text-primary-foreground glow-gold" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}{label}
    </button>
  );
}

function SwipeStack({ profiles, onDecision }: { profiles: DiscoverProfile[]; onDecision: (p: DiscoverProfile, a: "like" | "pass" | "super") => void }) {
  const visible = profiles.slice(0, 3);
  const top = visible[0];
  return (
    <div className="px-5 pt-6">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
        <AnimatePresence>
          {visible.slice().reverse().map((p, idx) => {
            const stackIndex = visible.length - 1 - idx;
            return (
              <SwipeCard
                key={p.id}
                profile={p}
                stackIndex={stackIndex}
                onDecision={(a) => onDecision(p, a)}
              />
            );
          })}
        </AnimatePresence>
      </div>
      <div className="mt-8">
        <SwipeActions onAction={(a) => top && onDecision(top, a)} disabled={!top} />
      </div>
    </div>
  );
}

function GridView({ profiles }: { profiles: DiscoverProfile[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = profiles.map((p) => p.photos?.[0]).filter(Boolean) as string[];
    signPhotos(paths).then(setUrls);
  }, [profiles]);

  return (
    <div className="grid grid-cols-2 gap-3 px-5 pt-5 sm:grid-cols-3">
      {profiles.map((p) => {
        const path = p.photos?.[0];
        const url = path ? urls[path] : null;
        const online = isOnline(p.last_seen);
        return (
          <div key={p.id} className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-surface">
            {url ? <img src={url} alt={p.display_name ?? ""} className="size-full object-cover transition-transform group-hover:scale-105" /> : <div className="size-full" />}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent" />
            {online && (
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-foreground backdrop-blur">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" /> online
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="font-display text-base leading-tight">
                {p.display_name}{ageFrom(p.birthdate) && <span className="text-foreground/70"> · {ageFrom(p.birthdate)}</span>}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="size-3" /> {formatDistance(p.distance_m)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ onRefresh, hasLocation }: { onRefresh: () => void; hasLocation: boolean }) {
  return (
    <CenterMessage
      icon={<Compass className="size-8 text-primary" />}
      title="No one new nearby right now."
      desc={hasLocation
        ? "Try widening your filters — or check back in a little while."
        : "Enable location for nearby people, or widen your filters."}
      action={<Button variant="hero" onClick={onRefresh}>Refresh</Button>}
    />
  );
}

function CenterMessage({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 pt-32 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-primary/30 bg-surface glow-gold">{icon}</div>
      <h2 className="wordmark mt-2 text-2xl font-medium">{title}</h2>
      {desc && <p className="max-w-xs text-sm text-muted-foreground">{desc}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
