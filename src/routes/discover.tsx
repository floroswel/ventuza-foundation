import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, ChevronLeft, ChevronRight, Compass, Flame, Hand, Heart, LayoutGrid, Layers, Loader2, MapPin, MessageCircle, Plane, Radar, Rocket, Ruler, Sparkles, SlidersHorizontal, Star, X } from "lucide-react";
import { SwipeCard, SwipeActions } from "@/components/SwipeCard";
import { useServerFn } from "@tanstack/react-start";
import { matchScore } from "@/lib/ai.functions";
import { PrivateAlbumViewer } from "@/components/PrivateAlbum";
import { getOrCreateConversation } from "@/lib/chat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { FiltersDrawer } from "@/components/FiltersDrawer";
import { MatchModal } from "@/components/MatchModal";
import { StoriesStrip } from "@/components/StoriesStrip";
import { QuickFiltersStrip } from "@/components/QuickFiltersStrip";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DEFAULT_FILTERS, fetchDiscover, requestAndStoreLocation,
  signPhotos, formatDistance, ageFrom, isOnline, formatLastSeen, formatHeight,
  type DiscoverFilters, type DiscoverProfile,
} from "@/lib/discover";
import { addFavorite, isFavorite, removeFavorite, sendTap, TAP_EMOJIS, type TapEmoji } from "@/lib/social";
import { sendWoof, hasWoofed } from "@/lib/ads";
import { SponsoredBanner } from "@/components/SponsoredBanner";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";


export const Route = createFileRoute("/discover")({
  head: () => ({ meta: [{ title: "Discover — Ventuza" }] }),
  component: DiscoverPage,
});

type Tab = "nearby" | "online" | "fresh";

function DiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("nearby");
  const [view, setView] = useState<"grid" | "swipe">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("vz_discover_view") as "grid" | "swipe") || "grid";
  });
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locStatus, setLocStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [match, setMatch] = useState<{ name: string; photo: string | null } | null>(null);
  const [selected, setSelected] = useState<DiscoverProfile | null>(null);

  function pickView(next: "grid" | "swipe") {
    setView(next);
    if (typeof window !== "undefined") localStorage.setItem("vz_discover_view", next);
  }

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

  // Debounce filter changes to avoid hammering the DB
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchDiscover(debouncedFilters, "distance");
      setProfiles(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load discover");
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, user]);

  useEffect(() => { void load(); }, [load]);

  // Realtime: refresh online status periodically (last_seen lives in profiles)
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      // Force re-render so isOnline() reevaluates against current time
      setProfiles((p) => p.slice());
    }, 30_000);
    return () => clearInterval(t);
  }, [user]);

  // Realtime: new match notifications (when someone else likes me back)
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`matches-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        async (payload) => {
          const m = payload.new as { user_a: string; user_b: string };
          if (m.user_a !== user.id && m.user_b !== user.id) return;
          const otherId = m.user_a === user.id ? m.user_b : m.user_a;
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name, photos")
            .eq("id", otherId)
            .maybeSingle();
          const path = prof?.photos?.[0];
          const signed = path ? (await signPhotos([path]))[path] : null;
          setMatch({ name: prof?.display_name ?? "Someone wonderful", photo: signed ?? null });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);



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

    const { error } = await supabase.from("swipes").insert({
      swiper_id: user.id, target_id: target.id, action,
    });
    if (error) {
      toast.error(error.message);
      return;
    }

    // Remove from grid only after DB confirms
    setProfiles((p) => p.filter((x) => x.id !== target.id));

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
          <div className="flex items-center gap-1">
            <div className="mr-1 flex items-center rounded-full border border-border bg-surface p-0.5">
              <button
                onClick={() => pickView("grid")}
                aria-label="Grid"
                title="Grilă (Grindr/Scruff)"
                className={cn("flex size-8 items-center justify-center rounded-full transition", view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => pickView("swipe")}
                aria-label="Swipe"
                title="Swipe (Tinder)"
                className={cn("flex size-8 items-center justify-center rounded-full transition", view === "swipe" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Layers className="size-4" />
              </button>
            </div>
            <Link
              to="/cruise"
              aria-label="Cruise · Right Now"
              className="flex size-10 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
            >
              <Radar className="size-4" />
            </Link>
            <NotificationBell />
            <button
              onClick={() => setFiltersOpen(true)}
              aria-label="Filters"
              className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-primary hover:bg-primary/10"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <TabBtn active={tab === "nearby"} onClick={() => setTab("nearby")}>Nearby</TabBtn>
          <TabBtn active={tab === "online"} onClick={() => setTab("online")}>Online</TabBtn>
          <TabBtn active={tab === "fresh"} onClick={() => setTab("fresh")}>Fresh</TabBtn>
        </div>

        <QuickFiltersStrip value={filters} onChange={setFilters} />
      </header>

      <StoriesStrip />
      <div className="px-3 pt-2"><SponsoredBanner placement="discover_card" /></div>
      {loading ? (
        <CenterMessage icon={<Loader2 className="size-6 animate-spin text-primary" />} title="Finding people…" />
      ) : visible.length === 0 ? (
        <EmptyState onRefresh={() => load()} hasLocation={locStatus === "granted"} />
      ) : view === "swipe" ? (
        <SwipeDeck profiles={visible} onDecision={handleDecision} onOpen={setSelected} />
      ) : (
        <>
          <OnlineRow profiles={profiles.filter((p) => isOnline(p.last_seen)).slice(0, 12)} onOpen={setSelected} />
          <Cascade profiles={visible} onOpen={setSelected} />
        </>
      )}

      <FiltersDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filters} onApply={setFilters} />
      <MatchModal open={!!match} onClose={() => setMatch(null)} otherName={match?.name ?? ""} otherPhotoUrl={match?.photo ?? null} />
      <ProfileSheet profile={selected} currentUserId={user?.id ?? null} onClose={() => setSelected(null)} onDecision={handleDecision} onMessage={async (p) => {
        try {
          const cid = await getOrCreateConversation(p.id);
          setSelected(null);
          navigate({ to: "/messages/$id", params: { id: cid } });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't open chat");
        }
      }} />
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

function SwipeDeck({
  profiles,
  onDecision,
  onOpen,
}: {
  profiles: DiscoverProfile[];
  onDecision: (p: DiscoverProfile, a: "like" | "pass" | "super") => void;
  onOpen: (p: DiscoverProfile) => void;
}) {
  // Render the top 3 cards as a stack (Tinder-style).
  const stack = profiles.slice(0, 3);
  const top = stack[0];
  if (!top) return null;
  return (
    <div className="px-4 pt-3">
      <div
        className="relative mx-auto w-full max-w-md"
        style={{ aspectRatio: "3 / 4.5" }}
        onClick={(e) => {
          // Tap (no drag) opens the profile sheet.
          if ((e.target as HTMLElement).closest("button")) return;
          onOpen(top);
        }}
      >
        {stack.map((p, i) => (
          <SwipeCard
            key={p.id}
            profile={p}
            stackIndex={i}
            onDecision={(a) => onDecision(p, a)}
          />
        ))}
      </div>
      <div className="mt-5 mx-auto max-w-md">
        <SwipeActions onAction={(a) => onDecision(top, a)} />
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Glisează → like · ← pass · ↑ super · sau apasă butoanele
        </p>
      </div>
    </div>
  );
}
function OnlineRow({ profiles, onOpen }: { profiles: DiscoverProfile[]; onOpen: (p: DiscoverProfile) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const { bySender } = useUnreadMessages();
  useEffect(() => {
    const paths = profiles.map((p) => p.photos?.[0]).filter(Boolean) as string[];
    if (paths.length) signPhotos(paths).then(setUrls);
  }, [profiles]);
  if (!profiles.length) return null;
  return (
    <div className="border-b border-border/40 px-4 py-3">
      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span className="mr-1.5 inline-block size-1.5 translate-y-[-1px] rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
        Online now · {profiles.length}
      </p>
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {profiles.map((p) => {
          const path = p.photos?.[0];
          const url = path ? urls[path] : null;
          const unread = bySender[p.id] ?? 0;
          return (
            <button key={p.id} onClick={() => onOpen(p)} className="group flex shrink-0 flex-col items-center gap-1">
              <span className={cn("relative block size-[66px] rounded-full p-[2px]", unread > 0 ? "snake-border bg-transparent" : "bg-gradient-to-tr from-primary via-primary-glow to-primary")}>
                <span className="relative z-[3] block size-full overflow-hidden rounded-full bg-surface ring-2 ring-background">
                  {url ? (
                    <img src={url} alt={p.display_name ?? ""} className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-lg text-muted-foreground/50">
                      {p.display_name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}
                </span>
                <span className="absolute bottom-0 right-0.5 z-[4] size-3 rounded-full bg-emerald-400 ring-2 ring-background shadow-[0_0_6px_rgb(52,211,153)]" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 z-[4] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_8px_rgba(244,63,94,0.7)] ring-2 ring-background">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              <span className="max-w-[68px] truncate text-[10px] text-foreground/80">{p.display_name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function Cascade({ profiles, onOpen }: { profiles: DiscoverProfile[]; onOpen: (p: DiscoverProfile) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const { bySender } = useUnreadMessages();
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
        const unread = bySender[p.id] ?? 0;
        return (
          <button
            key={p.id}
            onClick={() => onOpen(p)}
            className={cn(
              "group relative aspect-square overflow-hidden bg-surface focus:outline-none rounded-md",
              unread > 0 && "snake-border",
            )}
          >
            {url ? (
              <img src={url} alt={p.display_name ?? ""} loading="lazy" className="size-full object-cover transition-transform group-active:scale-95" />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl text-muted-foreground/40">
                {p.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/0 to-transparent" />
            {unread > 0 && (
              <span className="absolute left-1.5 top-1.5 z-10 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_0_10px_rgba(244,63,94,0.75)] ring-2 ring-black/40">
                <MessageCircle className="mr-0.5 size-2.5" />{unread > 9 ? "9+" : unread}
              </span>
            )}
            {online && (
              <span
                aria-label="online"
                className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153)] ring-2 ring-black/50"
              />
            )}
            {p.boost_until && new Date(p.boost_until) > new Date() && (
              <span aria-label="boosted" className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-lg backdrop-blur">
                <Rocket className="size-2.5" /> BOOST
              </span>
            )}
            {!(p.boost_until && new Date(p.boost_until) > new Date()) && p.verified && (
              <span aria-label="verified" className="absolute left-1.5 top-1.5 rounded-full bg-black/60 p-0.5 backdrop-blur">
                <BadgeCheck className="size-3.5 text-primary" />
              </span>
            )}
            {p.looking_now_until && new Date(p.looking_now_until) > new Date() && (
              <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-rose-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-lg backdrop-blur">
                <Flame className="size-2.5" /> NOW
              </span>
            )}
            {p.travel_city && (!p.travel_until || new Date(p.travel_until) > new Date()) && (
              <span className="absolute right-1.5 bottom-8 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] text-white backdrop-blur">
                <Plane className="size-2.5" /> {p.travel_city}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 p-1.5 text-left">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium leading-tight text-white">
                  {p.display_name}{age ? <span className="text-white/70">, {age}</span> : null}
                </p>
                {p.tribes && p.tribes.length > 0 && (
                  <p className="truncate text-[9px] uppercase tracking-wider text-primary/90">{p.tribes.slice(0, 2).join(" · ")}</p>
                )}
              </div>
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
  profile, currentUserId, onClose, onDecision, onMessage,
}: {
  profile: DiscoverProfile | null;
  currentUserId: string | null;
  onClose: () => void;
  onDecision: (p: DiscoverProfile, a: "like" | "pass" | "super") => void;
  onMessage: (p: DiscoverProfile) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    if (!profile?.photos?.length) { setUrls({}); return; }
    signPhotos(profile.photos).then(setUrls);
  }, [profile]);

  if (!profile) return null;
  const age = ageFrom(profile.birthdate);
  const photos = profile.photos ?? [];
  const currentPath = photos[idx];
  const currentUrl = currentPath ? urls[currentPath] : null;
  const lastSeenText = formatLastSeen(profile.last_seen);
  const online = isOnline(profile.last_seen);
  const heightStr = formatHeight(profile.height_cm);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-surface"
      >
        {/* Carousel */}
        <div className="relative aspect-square w-full bg-background">
          {currentUrl ? (
            <img src={currentUrl} alt={profile.display_name ?? ""} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-5xl text-muted-foreground/40">
              {profile.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />

          {photos.length > 1 && (
            <>
              <button
                onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur hover:bg-black/60"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                onClick={() => setIdx((i) => (i + 1) % photos.length)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur hover:bg-black/60"
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="absolute left-1/2 top-2 flex -translate-x-1/2 gap-1.5">
                {photos.map((_, i) => (
                  <span key={i} className={cn("h-1 w-6 rounded-full transition-all", i === idx ? "bg-white" : "bg-white/30")} />
                ))}
              </div>
            </>
          )}

          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-5">
            <h2 className="flex items-center gap-2 font-display text-3xl font-medium text-white">
              {profile.display_name}{age ? <span className="text-white/70">, {age}</span> : null}
              {profile.verified && <BadgeCheck className="size-5 text-primary" />}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", online ? "bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" : "bg-white/40")} />
                {lastSeenText}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {formatDistance(profile.distance_m)}
              </span>
              {heightStr && (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="size-3" /> {heightStr}
                </span>
              )}
            </div>
            <MatchScoreBadge target={profile} />
          </div>
        </div>


        <div className="space-y-5 px-5 pb-6 pt-4">
          {profile.tribes && profile.tribes.length > 0 && (
            <TagBlock label="Tribes" values={profile.tribes} gold />
          )}

          {(profile.body_type || profile.position || profile.ethnicity || profile.relationship_status || profile.weight_kg) && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background/50 p-3 text-xs">
              {profile.body_type && <Stat label="Body" value={profile.body_type} />}
              {profile.position && <Stat label="Position" value={profile.position} />}
              {profile.ethnicity && <Stat label="Ethnicity" value={profile.ethnicity} />}
              {profile.weight_kg && <Stat label="Weight" value={`${profile.weight_kg} kg`} />}
              {profile.relationship_status && <Stat label="Status" value={profile.relationship_status} />}
              {profile.hiv_status && <Stat label="HIV" value={profile.hiv_status} />}
            </div>
          )}

          {profile.pronouns?.length ? (
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{profile.pronouns.join(" · ")}</p>
          ) : null}

          {profile.bio && <p className="text-sm leading-relaxed text-foreground/90">{profile.bio}</p>}

          {profile.prompts && profile.prompts.length > 0 && (
            <div className="space-y-2">
              {profile.prompts.filter((p) => p.question && p.answer).map((p, i) => (
                <div key={i} className="rounded-2xl border border-border bg-background/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-primary">{p.question}</p>
                  <p className="mt-1 text-sm">{p.answer}</p>
                </div>
              ))}
            </div>
          )}

          {profile.looking_for?.length ? <TagBlock label="Looking for" values={profile.looking_for} /> : null}
          {profile.interests?.length ? <TagBlock label="Interests" values={profile.interests} /> : null}

          {currentUserId && <PrivateAlbumViewer ownerId={profile.id} currentUserId={currentUserId} />}

          {profile.looking_now_until && new Date(profile.looking_now_until) > new Date() && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <Flame className="size-3.5 text-rose-400" />
              <span className="font-medium uppercase tracking-wider">Right now</span>
              {profile.looking_now_intent && <span className="truncate text-rose-100/80">· {profile.looking_now_intent}</span>}
            </div>
          )}

          <TapFavoriteRow targetId={profile.id} targetName={profile.display_name ?? "Anonim"} />

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => onDecision(profile, "pass")}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" /> Pass
            </button>
            <button
              onClick={() => onMessage(profile)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-primary/40 bg-background text-sm text-primary hover:bg-primary/10"
            >
              <MessageCircle className="size-4" /> Message
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

function TapFavoriteRow({ targetId, targetName }: { targetId: string; targetName: string }) {
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tapped, setTapped] = useState<TapEmoji | null>(null);
  const [woofed, setWoofed] = useState(false);

  useEffect(() => {
    isFavorite(targetId).then(setFav).catch(() => {});
    hasWoofed(targetId).then(setWoofed).catch(() => {});
    setTapped(null);
  }, [targetId]);

  async function toggleFav() {
    setBusy(true);
    try {
      if (fav) { await removeFavorite(targetId); setFav(false); toast.success("Eliminat din favorite"); }
      else { await addFavorite(targetId); setFav(true); toast.success("Adăugat la favorite"); }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function woof() {
    if (woofed) return;
    setWoofed(true);
    try { await sendWoof(targetId); toast.success(`🐻 Woof trimis lui ${targetName}`); }
    catch (e) { setWoofed(false); toast.error((e as Error).message); }
  }

  async function tap(emoji: TapEmoji) {
    if (tapped) return;
    setTapped(emoji);
    try { await sendTap(targetId, emoji); toast.success(`${emoji} trimis lui ${targetName}`); }
    catch (e) { setTapped(null); toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Hand className="mr-1 inline size-3" /> Trimite un Tap
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={woof}
            disabled={woofed}
            aria-label="Woof"
            title="Woof — un salut prietenos, fără presiune"
            className={cn(
              "flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
              woofed ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-primary",
            )}
          >
            🐻 <span>Woof</span>
          </button>
          <button
            onClick={toggleFav}
            disabled={busy}
            aria-label={fav ? "Elimină de la favorite" : "Adaugă la favorite"}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border transition-colors",
              fav ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-primary",
            )}
          >
            <Star className={cn("size-4", fav && "fill-primary")} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TAP_EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => tap(e)}
            disabled={tapped !== null}
            className={cn(
              "flex h-9 w-11 items-center justify-center rounded-xl border text-lg transition-all",
              tapped === e
                ? "border-primary bg-primary/20 scale-110"
                : "border-border bg-background hover:border-primary hover:bg-primary/10",
              tapped && tapped !== e && "opacity-40",
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}


function TagBlock({ label, values, gold }: { label: string; values: string[]; gold?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px]",
              gold
                ? "border border-primary/40 bg-primary/10 text-primary"
                : "border border-border bg-background text-foreground/80",
            )}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-foreground/90">{value}</p>
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

function MatchScoreBadge({ target }: { target: DiscoverProfile }) {
  const { user } = useAuth();
  const score = useServerFn(matchScore);
  const cacheKey = user ? `vz_ms_${user.id}_${target.id}` : "";
  const [result, setResult] = useState<{ score: number; reason: string } | null>(() => {
    if (typeof window === "undefined" || !cacheKey) return null;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as { score: number; reason: string }) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!user) return;
    setLoading(true);
    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("display_name, birthdate, bio, interests, tribes, looking_for")
        .eq("id", user.id)
        .maybeSingle();
      const ageOf = (d: string | null | undefined) => {
        if (!d) return undefined;
        const diff = Date.now() - new Date(d).getTime();
        return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
      };
      const res = await score({
        data: {
          me: {
            name: me?.display_name ?? undefined,
            age: ageOf(me?.birthdate),
            bio: me?.bio ?? undefined,
            interests: me?.interests ?? [],
            tribes: me?.tribes ?? [],
            lookingFor: me?.looking_for ?? [],
          },
          them: {
            name: target.display_name ?? undefined,
            age: ageOf(target.birthdate),
            bio: target.bio ?? undefined,
            interests: target.interests ?? [],
            tribes: target.tribes ?? [],
            lookingFor: target.looking_for ?? [],
          },
        },
      });
      setResult(res);
      try { if (cacheKey) sessionStorage.setItem(cacheKey, JSON.stringify(res)); } catch { /* ignore */ }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI eșuat");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mt-3 inline-flex max-w-full items-start gap-2 rounded-2xl border border-primary/40 bg-black/50 px-3 py-2 text-xs text-white backdrop-blur">
        <span className="font-display text-lg font-medium text-primary leading-none">{result.score}</span>
        <span className="leading-snug text-white/85">{result.reason}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={loading}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-black/40 px-3 py-1.5 text-[11px] text-primary backdrop-blur hover:bg-black/60 disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
      Match score AI
    </button>
  );
}
