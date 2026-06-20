import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Compass, Heart, Loader2, MapPin, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
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

type Tab = "nearby" | "online" | "fresh";

function DiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("nearby");
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locStatus, setLocStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [match, setMatch] = useState<{ name: string; photo: string | null } | null>(null);
  const [selected, setSelected] = useState<DiscoverProfile | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) supabase.rpc("touch_last_seen");
  }, [user]);

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
      const data = await fetchDiscover(filters, "distance");
      setProfiles(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load discover");
    } finally {
      setLoading(false);
    }
  }, [filters, user]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    if (tab === "online") return profiles.filter((p) => isOnline(p.last_seen));
    if (tab === "fresh") {
      return [...profiles].sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());
    }
    return profiles;
  }, [profiles, tab]);

  const handleDecision = useCallback(async (target: DiscoverProfile, action: "like" | "pass" | "super") => {
    if (!user) return;
    setSelected(null);
    setProfiles((p) => p.filter((x) => x.id !== target.id));

    const { error } = await supabase.from("swipes").insert({
      swiper_id: user.id, target_id: target.id, action,
    });
    if (error) { toast.error(error.message); return; }
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
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/85 px-4 pb-2 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="wordmark text-2xl font-medium leading-none">Nearby</h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {visible.length} {visible.length === 1 ? "person" : "people"}
            </p>
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            aria-label="Filters"
            className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-primary hover:bg-primary/10"
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <TabBtn active={tab === "nearby"} onClick={() => setTab("nearby")}>Nearby</TabBtn>
          <TabBtn active={tab === "online"} onClick={() => setTab("online")}>Online</TabBtn>
          <TabBtn active={tab === "fresh"} onClick={() => setTab("fresh")}>Fresh</TabBtn>
        </div>
      </header>

      {loading ? (
        <CenterMessage icon={<Loader2 className="size-6 animate-spin text-primary" />} title="Finding people…" />
      ) : visible.length === 0 ? (
        <EmptyState onRefresh={() => load()} hasLocation={locStatus === "granted"} />
      ) : (
        <>
          <OnlineRow profiles={profiles.filter((p) => isOnline(p.last_seen)).slice(0, 12)} onOpen={setSelected} />
          <Cascade profiles={visible} onOpen={setSelected} />
        </>
      )}

      <FiltersDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filters} onApply={setFilters} />
      <MatchModal open={!!match} onClose={() => setMatch(null)} otherName={match?.name ?? ""} otherPhotoUrl={match?.photo ?? null} />
      <ProfileSheet profile={selected} onClose={() => setSelected(null)} onDecision={handleDecision} />
      <BottomNav />
    </main>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition-all",
        active
          ? "border-primary/60 bg-primary/10 text-primary glow-gold"
          : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Cascade({ profiles, onOpen }: { profiles: DiscoverProfile[]; onOpen: (p: DiscoverProfile) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = profiles.map((p) => p.photos?.[0]).filter(Boolean) as string[];
    if (paths.length) signPhotos(paths).then(setUrls);
  }, [profiles]);

  return (
    <div className="grid grid-cols-3 gap-[2px] p-[2px]">
      {profiles.map((p) => {
        const path = p.photos?.[0];
        const url = path ? urls[path] : null;
        const online = isOnline(p.last_seen);
        const age = ageFrom(p.birthdate);
        return (
          <button
            key={p.id}
            onClick={() => onOpen(p)}
            className="group relative aspect-square overflow-hidden bg-surface focus:outline-none"
          >
            {url ? (
              <img src={url} alt={p.display_name ?? ""} loading="lazy" className="size-full object-cover transition-transform group-active:scale-95" />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl text-muted-foreground/40">
                {p.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/0 to-transparent" />
            {online && (
              <span
                aria-label="online"
                className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153)] ring-2 ring-black/50"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 p-1.5 text-left">
              <p className="truncate text-[11px] font-medium leading-tight text-white">
                {p.display_name}{age ? <span className="text-white/70">, {age}</span> : null}
              </p>
              {p.distance_m != null && (
                <span className="shrink-0 text-[10px] text-white/70">{formatDistance(p.distance_m)}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ProfileSheet({
  profile, onClose, onDecision,
}: {
  profile: DiscoverProfile | null;
  onClose: () => void;
  onDecision: (p: DiscoverProfile, a: "like" | "pass" | "super") => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!profile?.photos?.[0]) { setUrl(null); return; }
    signPhotos([profile.photos[0]]).then((m) => setUrl(m[profile.photos![0]] ?? null));
  }, [profile]);

  if (!profile) return null;
  const age = ageFrom(profile.birthdate);
  const online = isOnline(profile.last_seen);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-border bg-surface"
      >
        <div className="relative aspect-square w-full bg-background">
          {url && <img src={url} alt={profile.display_name ?? ""} className="size-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h2 className="font-display text-3xl font-medium text-white">
              {profile.display_name}{age ? <span className="text-white/70">, {age}</span> : null}
            </h2>
            <div className="mt-1 flex items-center gap-3 text-xs text-white/80">
              {online && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" /> online
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {formatDistance(profile.distance_m)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 pb-5 pt-4">
          {profile.pronouns?.length ? (
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{profile.pronouns.join(" · ")}</p>
          ) : null}
          {profile.bio && <p className="text-sm leading-relaxed text-foreground/90">{profile.bio}</p>}
          {profile.interests?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.slice(0, 8).map((t) => (
                <span key={t} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground/80">{t}</span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => onDecision(profile, "pass")}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" /> Pass
            </button>
            <button
              onClick={() => onDecision(profile, "like")}
              className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground glow-gold"
            >
              <Heart className="size-4" /> Like
            </button>
          </div>
        </div>
      </div>
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
