import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DiscoverSkeleton } from "@/components/skeletons/FirstScreenSkeletons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  Flame,
  Hand,
  Heart,
  LayoutGrid,
  Layers,
  Loader2,
  MapPin,
  MessageCircle,
  Plane,
  Radar,
  Rocket,
  Ruler,
  Sparkles,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import {
  nextEligibleId,
  sheetOutcomeFor,
  shouldSendDecision,
  type DecisionAction,
} from "@/lib/discover-decision";
import { SwipeCard, SwipeActions } from "@/components/SwipeCard";
import { SmartImage } from "@/components/SmartImage";
import { PresenceDot } from "@/components/PresenceDot";

import { useServerFn } from "@tanstack/react-start";
import { matchScore } from "@/lib/ai.functions";
import { useCachedUserBadges } from "@/lib/badges-cache";
import { BadgeStrip } from "@/components/BadgeStrip";
import { PrivateAlbumViewer } from "@/components/PrivateAlbum";
import { getOrCreateConversation } from "@/lib/chat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCountryGate } from "@/lib/country-gate";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { FiltersDrawer } from "@/components/FiltersDrawer";
import { MatchModal } from "@/components/MatchModal";

import { GoldenHourBadge } from "@/components/GoldenHourBadge";
import { QuickFiltersStrip } from "@/components/QuickFiltersStrip";
import { NotificationBell } from "@/components/NotificationBell";
import { LocationOnboarding } from "@/components/LocationOnboarding";
import {
  DEFAULT_FILTERS,
  DISCOVER_PAGE_SIZE,
  fetchDiscover,
  requestAndStoreLocation,
  signPhotos,
  peekPhotos,
  prefetchProfilePhotos,

  formatDistance,
  ageFrom,
  isOnline,
  formatLastSeen,
  formatHeight,
  type DiscoverFilters,
  type DiscoverProfile,
} from "@/lib/discover";
// Filtrele Discover pornesc mereu goale (DEFAULT_FILTERS) — nu mai
// re-hidratăm nimic din localStorage la fiecare sesiune.

import {
  addFavorite,
  isFavorite,
  removeFavorite,
  sendTap,
  TAP_EMOJIS,
  type TapEmoji,
} from "@/lib/social";
import { SponsoredBanner } from "@/components/SponsoredBanner";
import { cn } from "@/lib/utils";
import { useOptionLabel } from "@/lib/i18n/option-labels";
import { PositionTag } from "@/components/PositionTag";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { QuickProfileDrawer } from "@/components/QuickProfileDrawer";
import { DailyRewardCard } from "@/components/DailyRewardCard";
import { ProfilePhotoGallery } from "@/components/ProfilePhotoGallery";
import { withGuardian } from "@/components/with-guardian";

export const Route = createFileRoute("/discover")({
  head: () => ({ meta: [{ title: "Discover — Suzeta" }] }),
  component: withGuardian("discover", DiscoverPage, "matching"),
});

type Tab = "nearby" | "fresh";

function DiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const countryGate = useCountryGate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("nearby");
  const [view, setView] = useState<"grid" | "swipe">("grid");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem("vz_discover_view");
    if (v === "swipe" || v === "grid") setView(v);
  }, []);
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersHydratedRef = useRef(false);
  // Seed profiluri din cache-ul persister (key ["discover-seen", userId]).
  // Astfel la re-open offline vezi ultimele profiluri fără net.
  const cachedProfiles = user
    ? queryClient.getQueryData<DiscoverProfile[]>(["discover-seen", user.id])
    : undefined;
  const [profiles, setProfiles] = useState<DiscoverProfile[]>(cachedProfiles ?? []);
  const [badgesMap, setBadgesMap] = useState<Record<string, string[]>>({});
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [badgesError, setBadgesError] = useState(false);
  const fetchUserBadges = useCachedUserBadges();
  const [loading, setLoading] = useState(!cachedProfiles || cachedProfiles.length === 0);
  const [locStatus, setLocStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [match, setMatch] = useState<{ id: string; name: string; photo: string | null } | null>(
    null,
  );
  const [selected, setSelected] = useState<DiscoverProfile | null>(null);
  const [incognitoBusy, setIncognitoBusy] = useState(false);

  // Profilul meu — key ["my-profile", userId] este în allowlist-ul persister-ului.
  const myProfileQuery = useQuery({
    queryKey: ["my-profile", user?.id ?? "anon"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        // `profile_slug` + `display_name`: push-ul de Like trebuie să ducă la
        // profilul CELUI care a dat Like, exact ca notificarea din clopoțel.
        .select("incognito, profile_slug, display_name")
        .eq("id", user.id)
        .maybeSingle();
      return (data ?? null) as {
        incognito: boolean | null;
        profile_slug: string | null;
        display_name: string | null;
      } | null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  const incognito = !!myProfileQuery.data?.incognito;
  const mySlug = myProfileQuery.data?.profile_slug ?? null;
  const myName = myProfileQuery.data?.display_name ?? null;

  /**
   * Deciziile luate în sesiunea curentă. Like-ul rămâne pe profil, deci
   * butonul trebuie să arate că a fost trimis, iar un al doilea tap nu mai
   * trimite nimic. Pass-ul filtrează profilul din listă ca să nu reapară.
   */
  const [decisions, setDecisions] = useState<Record<string, DecisionAction>>({});
  const passedIds = useMemo(
    () => new Set(Object.keys(decisions).filter((id) => decisions[id] === "pass")),
    [decisions],
  );

  // Mirror profiluri afișate în cache pentru offline restore.
  useEffect(() => {
    if (!user || profiles.length === 0) return;
    queryClient.setQueryData(["discover-seen", user.id], profiles.slice(0, 50));
  }, [profiles, user, queryClient]);



  const toggleIncognito = useCallback(async () => {
    if (!user || incognitoBusy) return;
    const next = !incognito;
    setIncognitoBusy(true);
    // Optimistic update — MERGE, nu înlocuire: obiectul din cache mai conține
    // `profile_slug` și `display_name`, de care depinde push-ul de Like.
    const patch = (value: boolean) =>
      queryClient.setQueryData(
        ["my-profile", user.id],
        (old: { incognito: boolean | null } | null | undefined) => ({
          ...(old ?? { profile_slug: null, display_name: null }),
          incognito: value,
        }),
      );
    patch(next);
    const { error } = await supabase.from("profiles").update({ incognito: next }).eq("id", user.id);
    setIncognitoBusy(false);
    if (error) {
      patch(!next);
      toast.error(error.message);
    } else {
      void myProfileQuery.refetch();
      toast.success(
        next ? "Mod incognito activat — profilul tău e ascuns" : "Ești din nou vizibil",
      );
    }
  }, [user, incognito, incognitoBusy, queryClient, myProfileQuery]);


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
    void import("@/lib/native-geolocation").then(async ({ getLocationPermissionState }) => {
      const permission = await getLocationPermissionState();
      if (permission !== "granted") {
        setLocStatus("denied");
        return;
      }
      const r = await requestAndStoreLocation();
      setLocStatus(r.ok ? "granted" : "denied");
      if (r.ok) {
        // Informăm userul o singură dată că poate opri oricând locația din
        // browser (🔒 lângă URL) sau din setările sistemului — fără să-l
        // punem să se plimbe prin app ca să o activeze.
        const KEY = "vz_loc_hint_shown";
        if (typeof localStorage !== "undefined" && !localStorage.getItem(KEY)) {
          localStorage.setItem(KEY, "1");
          toast.success("Locație activată", {
            id: "loc-enabled",
            description:
              "Îți arătăm profiluri din apropiere. Poți opri oricând locația din 🔒 (lângă URL) sau din setările telefonului.",
            duration: 7000,
          });
        }
      }
    });
  }, [user, locStatus]);

  // Filtrele NU se restaurează automat între sesiuni — pornim mereu de la
  // DEFAULT_FILTERS (fără nimic activ). Se activează doar dacă userul apasă
  // explicit pe un pill/opțiune. Curățăm și orice snapshot vechi din localStorage.
  useEffect(() => {
    if (!user || filtersHydratedRef.current) return;
    filtersHydratedRef.current = true;
    try {
      window.localStorage.removeItem(`vz_discover_filters:${user.id}`);
    } catch {
      /* private mode / quota — ignore */
    }
  }, [user]);


  // Debounce filter changes to avoid hammering the DB
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  const [loadError, setLoadError] = useState<{ message: string; code?: string } | null>(null);
  const [autoExpanded, setAutoExpanded] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const effectiveFiltersRef = useRef<DiscoverFilters>(debouncedFilters);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    setAutoExpanded(null);
    setHasMore(false);
    try {
      let data = await fetchDiscover(debouncedFilters, "distance", { offset: 0 });
      let effective = debouncedFilters;
      // Auto-fallback progresiv: dacă userul nu are NICIUN rezultat la raza
      // curentă, încercăm trepte 25→50→200→5000 km. Nu modificăm filtrele
      // userului (nu rescriem `filters`) — doar arătăm rezultate marcate
      // "raza extinsă". Userul rămâne în control.
      if (data.length === 0) {
        // O singură treaptă de fallback ca să economisim quota (10 apeluri/h server-side).
        const current = debouncedFilters.maxDistanceKm ?? 25;
        const fallbackKm = current < 5000 ? 5000 : null;
        if (fallbackKm) {
          try {
            const alt = await fetchDiscover(
              { ...debouncedFilters, maxDistanceKm: fallbackKm },
              "distance",
              { offset: 0 },
            );
            if (alt.length > 0) {
              data = alt;
              effective = { ...debouncedFilters, maxDistanceKm: fallbackKm };
              setAutoExpanded(fallbackKm);
            }
          } catch {
            // ignorăm erori pe fallback — arătăm empty state, nu blocăm ecranul
          }
        }
      }
      effectiveFiltersRef.current = effective;
      setProfiles(data);
      setHasMore(data.length >= DISCOVER_PAGE_SIZE);
      // Fetch server-side badges for the loaded profiles (fire-and-forget).
      if (data.length > 0) {
        setBadgesLoading(true);
        setBadgesError(false);
        void fetchUserBadges(data.map((d) => d.id))
          .then((map) => {
            setBadgesMap((prev) => ({ ...prev, ...map }));
          })
          .catch(() => {
            setBadgesError(true);
          })
          .finally(() => setBadgesLoading(false));
      } else {
        setBadgesMap({});
        setBadgesLoading(false);
        setBadgesError(false);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't load discover";
      const code = (e as { code?: string } | null)?.code;
      setLoadError({ message, code });
      // Terminal errors already shown inline (CenterMessage + CTA) — don't toast on repeat.
      const inlineOnly =
        code === "email_not_confirmed" ||
        code === "age_verification_required" ||
        code === "not_authenticated";
      if (!inlineOnly) toast.error(message, { id: `discover-load-${code ?? "err"}` });
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, user]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextOffset = profiles.length;
      const batch = await fetchDiscover(effectiveFiltersRef.current, "distance", {
        offset: nextOffset,
      });
      if (batch.length === 0) {
        setHasMore(false);
        return;
      }
      // Dedup pe id (RPC-ul poate returna aceleași profiluri la reordonări).
      setProfiles((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const p of batch) if (!seen.has(p.id)) merged.push(p);
        return merged;
      });
      setHasMore(batch.length >= DISCOVER_PAGE_SIZE);
      // Badges pentru batch-ul nou.
      const ids = batch.map((b) => b.id);
      if (ids.length > 0) {
        void fetchUserBadges(ids)
          .then((map) => setBadgesMap((prev) => ({ ...prev, ...map })))
          .catch(() => {
            /* fallback silențios — deja avem badge-uri pentru batch-ul anterior */
          });
      }
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code === "discover_rate_limited") {
        setHasMore(false);
        toast.info("Ai atins limita de răsfoire pe oră. Reia mai târziu.", {
          id: "discover-more-limited",
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }, [user, loadingMore, loading, hasMore, profiles.length]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refresh online status periodically (last_seen lives in profiles)
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      // Force re-render so isOnline() reevaluates against current time
      setProfiles((p) => p.slice());
    }, 30_000);
    return () => clearInterval(t);
  }, [user]);

  // Realtime location/discover refresh: profile location changes reorder nearby people.
  // Rate-limited server-side (10 calls/hour). Așa că:
  // - NU mai facem setInterval periodic (spamma quota și genera "discover_rate_limited").
  // - Facem refresh DOAR pe evenimente realtime, debounced la max 1 apel / 60s.
  useEffect(() => {
    if (!user) return;
    const terminal =
      loadError?.code === "email_not_confirmed" ||
      loadError?.code === "age_verification_required" ||
      loadError?.code === "not_authenticated" ||
      loadError?.code === "discover_rate_limited";
    if (terminal) return;

    let lastRefresh = Date.now();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const REFRESH_MIN_INTERVAL = 60_000;
    const scheduleRefresh = () => {
      const elapsed = Date.now() - lastRefresh;
      const wait = Math.max(0, REFRESH_MIN_INTERVAL - elapsed);
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        lastRefresh = Date.now();
        void load();
      }, wait);
    };

    const ch = supabase
      .channel(`discover-profiles:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profile_live_events" },
        scheduleRefresh,
      )
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(ch);
    };
  }, [user, load, loadError?.code]);

  // Re-fetch când watcher-ul de locație raportează mișcare semnificativă.
  useEffect(() => {
    if (!user) return;
    const onMoved = () => {
      setLocStatus("granted");
      void load();
    };
    window.addEventListener("suzeta:location-updated", onMoved);
    return () => window.removeEventListener("suzeta:location-updated", onMoved);
  }, [user, load]);

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
          setMatch({
            id: otherId,
            name: prof?.display_name ?? "Someone wonderful",
            photo: signed ?? null,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const visible = useMemo(() => {
    // Pass scoate profilul din listă pentru sesiunea curentă: „nu relua imediat
    // profilurile cărora li s-a dat Pass”. Like-ul NU scoate nimic.
    const pool = profiles.filter((p) => !passedIds.has(p.id));
    if (tab === "fresh") {
      return [...pool].sort(
        (a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime(),
      );
    }
    // Nearby (Grindr-style): online first, apoi distanță ascendentă.
    // Profilele NU dispar după Like — se reordonează doar când se schimbă
    // distanța sau status-ul online (see load() + interval 30s).
    const DIST_UNKNOWN = Number.POSITIVE_INFINITY;
    return [...pool].sort((a, b) => {
      const aOn = isOnline(a.last_seen) ? 0 : 1;
      const bOn = isOnline(b.last_seen) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      const da = a.distance_m ?? DIST_UNKNOWN;
      const db = b.distance_m ?? DIST_UNKNOWN;
      if (da !== db) return da - db;
      // Tie-break: cel mai recent văzut sus, ca să nu bâlbâie ordinea.
      return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
    });
  }, [profiles, tab, passedIds]);

  const handleDecision = useCallback(
    async (target: DiscoverProfile, action: "like" | "pass" | "super") => {
      if (!user) return;

      // Al doilea tap pe Like nu mai trimite nimic: nici rând în `swipes`,
      // nici o a doua notificare la destinatar.
      if (!shouldSendDecision(action, decisions[target.id])) return;

      // Următorul profil se calculează ÎNAINTE ca cel curent să fie scos din
      // listă de `passedIds`, altfel indexul s-ar deplasa sub noi.
      const outcome = sheetOutcomeFor(
        action,
        nextEligibleId(
          visible.map((p) => p.id),
          target.id,
          passedIds,
        ),
      );

      setDecisions((d) => ({ ...d, [target.id]: action }));

      // Fiecare gest cu propriul efect asupra sheet-ului deschis:
      //   Like → rămâne pe profil;  Pass → următorul profil;  fără următor → Grid.
      // Back/X folosesc `onClose`, care a rămas singurul drum înapoi în Grid.
      if (selected?.id === target.id && outcome.kind !== "stay") {
        setSelected(
          outcome.kind === "advance"
            ? (visible.find((p) => p.id === outcome.next) ?? null)
            : null,
        );
      }

      // O relație swiper/target este unică în DB.
      const { error } = await supabase.from("swipes").upsert(
        {
          swiper_id: user.id,
          target_id: target.id,
          action,
        },
        { onConflict: "swiper_id,target_id", ignoreDuplicates: true },
      );
      if (error) {
        toast.error(error.message);
        // Decizia nu a ajuns în DB — nu o ținem marcată local, altfel butonul
        // ar arăta „trimis” pentru un Like inexistent.
        setDecisions((d) => {
          const next = { ...d };
          delete next[target.id];
          return next;
        });
        return;
      }

      // Grid (Grindr-style): profilul rămâne în grilă — se reordonează doar
      // după distance/online. Doar view=swipe scoate cardul (altfel utilizatorul
      // ar vedea la infinit același card).
      if (view === "swipe") {
        setProfiles((p) => p.filter((x) => x.id !== target.id));
      }

      if (action === "like" || action === "super") {
        const { data: m } = await supabase
          .from("matches")
          .select("id")
          .or(
            `and(user_a.eq.${user.id},user_b.eq.${target.id}),and(user_a.eq.${target.id},user_b.eq.${user.id})`,
          )
          .maybeSingle();
        if (m) {
          const photoPath = target.photos?.[0];
          const signed = photoPath ? (await signPhotos([photoPath]))[photoPath] : null;
          setMatch({
            id: target.id,
            name: target.display_name ?? "Someone wonderful",
            photo: signed ?? null,
          });

          // Push MATCH către celălalt user. Server fn skip-uie self automat.
          // `sendPushToUser` respectă notification_prefs + quiet hours + discrete_mode.
          void (async () => {
            try {
              const { sendPushToUser } = await import("@/lib/push.functions");
              await sendPushToUser({
                data: {
                  toUserId: target.id,
                  title: "Match nou pe Suzeta! 💫",
                  body: `Ai făcut match cu ${target.display_name ?? "cineva"}.`,
                  url: "/messages",
                  tag: `match:${m.id}`,
                  category: "matches",
                },
              });
            } catch (e) {
              console.warn("[discover] match push failed", e);
            }
          })();
        } else {
          // Like unilateral. Push-ul și notificarea din clopoțel (creată de
          // trigger-ul DB `tg_notify_new_like`) trebuie să spună ACELAȘI lucru
          // și să ducă la ACELAȘI loc — profilul celui care a dat Like.
          // `tag` este identic pentru aceeași pereche, deci un Like repetat
          // înlocuiește notificarea, nu adaugă una nouă.
          void (async () => {
            try {
              const { sendPushToUser } = await import("@/lib/push.functions");
              await sendPushToUser({
                data: {
                  toUserId: target.id,
                  title: `${myName ?? "Cineva"} ți-a dat Like ❤️`,
                  body: "Vezi profilul.",
                  url: mySlug ? `/u/${mySlug}` : "/discover",
                  tag: `like:${user.id}:${target.id}`,
                  category: "likes",
                },
              });
            } catch (e) {
              console.warn("[discover] like push failed", e);
            }
          })();
        }
      }
    },
    [user, view, decisions, visible, passedIds, selected, mySlug, myName],
  );

  // Grid: păstrează poziția de derulare la închiderea profilului.
  // Modalul e `fixed inset-0`, deci grila din spate rămâne montată, dar
  // documentul poate fi derulat sau reașezat cât timp modalul e deschis
  // (reordonare după distanță/online, refresh realtime). Memorăm poziția la
  // deschidere și o restaurăm după ce grila s-a re-randat.
  const gridScrollYRef = useRef(0);
  const modalWasOpenRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selected && !modalWasOpenRef.current) {
      modalWasOpenRef.current = true;
      gridScrollYRef.current = window.scrollY;
      return;
    }
    if (!selected && modalWasOpenRef.current) {
      modalWasOpenRef.current = false;
      const y = gridScrollYRef.current;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, [selected]);

  if (countryGate.isDiscoverDisabled || countryGate.forceStealth || countryGate.isBlocked) {
    return (
      <main className="min-h-dvh bg-background px-6 py-16 text-foreground">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h1 className="font-serif text-2xl">Discovery is off in your region</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Public discovery has been turned off for your safety. You can still edit your profile
            and manage your account. See our{" "}
            <a href="/safety" className="underline underline-offset-2">
              safety tips
            </a>{" "}
            for meeting people privately.
          </p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh bg-background pb-nav">
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/85 px-3 pb-1 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <QuickProfileDrawer />
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">Locația curentă</span>
            </button>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            <div className="mr-1 flex items-center rounded-full border border-border bg-surface p-0.5">
              <button
                onClick={() => pickView("grid")}
                aria-label="Grid"
                title="Grilă (Grindr/Scruff)"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition",
                  view === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => pickView("swipe")}
                aria-label="Swipe"
                title="Swipe (Tinder)"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition",
                  view === "swipe"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Layers className="size-4" />
              </button>
            </div>
            <button
              onClick={toggleIncognito}
              disabled={incognitoBusy}
              aria-label={incognito ? "Dezactivează incognito" : "Activează incognito"}
              title={
                incognito
                  ? "Ești invizibil — apasă ca să revii la vizibil"
                  : "Mod incognito — ascunde-ți profilul din Discover"
              }
              className={cn(
                "flex size-9 items-center justify-center rounded-full border transition",
                incognito
                  ? "border-amber-500/60 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {incognitoBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : incognito ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
            <Link
              to="/cruise"
              aria-label="Cruise · Right Now"
              className="flex size-9 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
            >
              <Radar className="size-4" />
            </Link>
            <NotificationBell />
            <button
              onClick={() => setFiltersOpen(true)}
              aria-label="Filters"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-primary hover:bg-primary/10"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        </div>

        {/* Incognito se comuta dintr-un buton doar-iconita, iar efectul lui —
            disparitia din grila ALTORA — nu se vede de pe contul tau. Fara un
            semnal permanent, singura confirmare era un toast care dispare, deci
            parea ca butonul nu face nimic. */}
        {incognito && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            <EyeOff className="size-4 shrink-0" />
            <p className="flex-1">
              Ești invizibil: profilul tău nu apare în grila celorlalți. Tu poți naviga normal.
            </p>
            <button
              onClick={toggleIncognito}
              disabled={incognitoBusy}
              className="shrink-0 rounded-full border border-amber-500/50 px-2.5 py-1 font-medium hover:bg-amber-500/20"
            >
              Ieși
            </button>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabBtn active={tab === "nearby"} onClick={() => setTab("nearby")}>
            Nearby
          </TabBtn>
          <TabBtn active={tab === "fresh"} onClick={() => setTab("fresh")}>
            Fresh
          </TabBtn>
          <GoldenHourBadge className="ml-1 flex-shrink-0" />
        </div>


        <QuickFiltersStrip value={filters} onChange={setFilters} />
      </header>

      <DailyRewardCard />

      <div className="px-3 pt-2">
        <SponsoredBanner placement="discover_card" />
      </div>
      {locStatus === "denied" && (
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground">Activează locația</div>
            <div className="text-muted-foreground">
              Fără locație nu îți putem arăta cine e aproape. O poți opri oricând din 🔒
              (lângă URL) sau din setările telefonului.
            </div>
          </div>
          <Button
            size="sm"
            variant="hero"
            className="shrink-0"
            onClick={async () => {
              const r = await requestAndStoreLocation();
              if (r.ok) {
                setLocStatus("granted");
                toast.success("Locație activată");
                load();
              } else {
                const { openLocationSettings } = await import("@/lib/native-geolocation");
                const opened = await openLocationSettings();
                toast.message(opened ? "Permite locația pentru Suzeta" : "Locația nu a fost activată", {
                  description: opened
                    ? "Activează permisiunea în ecranul deschis, apoi revino în aplicație."
                    : (r.error ?? "Permite locația din setările aplicației."),
                  duration: 6000,
                });
              }
            }}
          >
            Activează locația
          </Button>
        </div>
      )}

      {loading ? (
        // Skeleton cu aceeași formă ca grila reală: layoutul e vizibil instant
        // și nu mai sare când sosesc datele.
        <DiscoverSkeleton />
      ) : loadError ? (
        <CenterMessage
          icon={<Compass className="size-8 text-destructive" />}
          title={
            loadError.code === "discover_rate_limited"
              ? "Prea multe cereri"
              : loadError.code === "email_not_confirmed"
                ? "Confirmă-ți emailul"
                : loadError.code === "age_verification_required"
                  ? "Verifică-ți vârsta"
                  : "Ceva nu a mers"
          }
          desc={loadError.message}
          action={
            loadError.code === "email_not_confirmed" ? (
              <Button asChild variant="hero">
                <Link
                  to="/auth/check-email"
                  search={{ email: user?.email ?? undefined }}
                >
                  Retrimite emailul
                </Link>
              </Button>
            ) : loadError.code === "age_verification_required" ? (
              <Button asChild variant="hero">
                <Link to="/settings">Verifică acum</Link>
              </Button>
            ) : loadError.code === "not_authenticated" ? (
              <Button asChild variant="hero">
                <Link to="/auth" search={{ mode: "login" }}>
                  Autentifică-te
                </Link>
              </Button>
            ) : (
              <Button variant="hero" onClick={() => load()}>
                Reîncearcă
              </Button>
            )
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          onRefresh={() => load()}
          hasLocation={locStatus === "granted"}
          hasFilters={JSON.stringify(debouncedFilters) !== JSON.stringify(DEFAULT_FILTERS)}
          onResetFilters={() => setFilters(DEFAULT_FILTERS)}
          currentDistanceKm={filters.maxDistanceKm}
          onExpandDistance={(km) => setFilters({ ...filters, maxDistanceKm: km })}
        />
      ) : view === "swipe" ? (
        <>
          {autoExpanded != null && (
            <div className="mx-3 mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              N-am găsit nimeni la {filters.maxDistanceKm ?? 25} km. Îți arătăm rezultate până la{" "}
              <span className="font-medium text-primary">
                {autoExpanded === 5000 ? "nivel național" : `${autoExpanded} km`}
              </span>
              .{" "}
              <button
                className="underline"
                onClick={() => setFilters({ ...filters, maxDistanceKm: autoExpanded })}
              >
                Setează ca implicit
              </button>
            </div>
          )}
          <SwipeDeck profiles={visible} onDecision={handleDecision} onOpen={setSelected} />
        </>
      ) : (
        <>
          <OnlineRow
            profiles={profiles.filter((p) => isOnline(p.last_seen)).slice(0, 12)}
            onOpen={setSelected}
          />
          <div className="px-4 pb-1 pt-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Toți din grid
            </p>
          </div>
          <Cascade
            profiles={[...visible].sort(
              (a, b) =>
                (a.distance_m ?? Number.MAX_SAFE_INTEGER) -
                (b.distance_m ?? Number.MAX_SAFE_INTEGER),
            )}
            onOpen={setSelected}
            badgesMap={badgesMap}
            badgesLoading={badgesLoading}
            badgesError={badgesError}
          />
          <InfiniteScrollSentinel
            onReach={loadMore}
            hasMore={hasMore}
            loading={loadingMore}
          />
        </>
      )}

      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onApply={setFilters}
        onReset={() => {
          setFilters(DEFAULT_FILTERS);
          setDebouncedFilters(DEFAULT_FILTERS);
          try {
            if (user) window.localStorage.removeItem(`vz_discover_filters:${user.id}`);
          } catch {
            /* ignore */
          }
          toast.success("Filtre resetate");
        }}

      />

      <MatchModal
        open={!!match}
        onClose={() => setMatch(null)}
        otherName={match?.name ?? ""}
        otherPhotoUrl={match?.photo ?? null}
        onSendFirstMessage={
          match
            ? async () => {
                try {
                  const cid = await getOrCreateConversation(match.id);
                  setMatch(null);
                  navigate({ to: "/messages/$id", params: { id: cid } });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Nu am putut deschide conversația");
                }
              }
            : undefined
        }
      />
      <ProfileSheet
        profile={selected}
        allProfiles={visible}
        currentUserId={user?.id ?? null}
        decision={selected ? decisions[selected.id] : undefined}
        onClose={() => setSelected(null)}
        onNavigate={(p) => setSelected(p)}
        onDecision={handleDecision}
        onMessage={async (p) => {
          try {
            const cid = await getOrCreateConversation(p.id);
            setSelected(null);
            navigate({ to: "/messages/$id", params: { id: cid } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't open chat");
          }
        }}
      />
      <BottomNav />
    </main>
  );
}

function InfiniteScrollSentinel({
  onReach,
  hasMore,
  loading,
}: {
  onReach: () => void;
  hasMore: boolean;
  loading: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) onReach();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onReach]);
  if (!hasMore && !loading) return null;
  return (
    <div
      ref={ref}
      className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"
      aria-live="polite"
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Se încarcă mai multe…
        </>
      ) : hasMore ? (
        "Scroll pentru mai multe"
      ) : null}
    </div>
  );
}



function TabBtn({
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
          <SwipeCard key={p.id} profile={p} stackIndex={i} onDecision={(a) => onDecision(p, a)} />
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
function OnlineRow({
  profiles,
  onOpen,
}: {
  profiles: DiscoverProfile[];
  onOpen: (p: DiscoverProfile) => void;
}) {
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
            <button
              key={p.id}
              onClick={() => onOpen(p)}
              className="group flex shrink-0 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "relative block size-[66px] rounded-full p-[2px]",
                  unread > 0
                    ? "snake-border bg-transparent"
                    : "bg-gradient-to-tr from-primary via-primary-glow to-primary",
                )}
              >
                <span className="relative z-[3] block size-full overflow-hidden rounded-full bg-surface ring-2 ring-background">
                  {url ? (
                    <SmartImage src={url} alt={p.display_name ?? ""} className="size-full object-cover" />
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
              <span className="max-w-[68px] truncate text-[10px] text-foreground/80">
                {p.display_name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Cascade({
  profiles,
  onOpen,
  badgesMap,
  badgesLoading,
  badgesError,
}: {
  profiles: DiscoverProfile[];
  onOpen: (p: DiscoverProfile) => void;
  badgesMap: Record<string, string[]>;
  badgesLoading: boolean;
  badgesError: boolean;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const label = useOptionLabel();
  const { bySender } = useUnreadMessages();
  useEffect(() => {
    const first = profiles.map((p) => p.photos?.[0]).filter(Boolean) as string[];
    if (!first.length) return;
    setUrls((prev) => ({ ...prev, ...peekPhotos(first) }));
    // 1) semnăm rapid pozele de copertă (afișare grilă)
    signPhotos(first).then((next) => setUrls((prev) => ({ ...prev, ...next })));
    // 2) în fundal, pre-semnăm și pre-descărcăm restul pozelor fiecărui profil
    void prefetchProfilePhotos(profiles);
  }, [profiles]);

  return (
    <div className="grid grid-cols-3 gap-1.5 px-1.5 pb-2">
      {profiles.map((p, i) => {
        const path = p.photos?.[0];
        const url = path ? urls[path] : null;
        const eager = i < 12;

        const online = isOnline(p.last_seen);
        const age = ageFrom(p.birthdate);
        const unread = bySender[p.id] ?? 0;
        return (
          <button
            key={p.id}
            onClick={() => onOpen(p)}
            className={cn(
              "group relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface ring-1 ring-border/50 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97]",
              unread > 0 && "snake-border",
            )}
          >
            {url ? (
              <SmartImage
                src={url}
                alt={p.display_name ?? ""}
                loading={eager ? "eager" : "lazy"}
                fetchPriority={eager ? "high" : "low"}
                className="size-full object-cover"
              />
            ) : (

              <div className="flex size-full items-center justify-center text-2xl text-muted-foreground/40">
                {p.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />

            {unread > 0 && (
              <span className="absolute left-1.5 top-1.5 z-10 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_0_10px_rgba(244,63,94,0.75)] ring-2 ring-black/40">
                <MessageCircle className="mr-0.5 size-2.5" />
                {unread > 9 ? "9+" : unread}
              </span>
            )}
            {p.boost_until && new Date(p.boost_until) > new Date() && (
              <span
                aria-label="boosted"
                className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-lg backdrop-blur"
              >
                <Rocket className="size-2.5" /> BOOST
              </span>
            )}
            {!(p.boost_until && new Date(p.boost_until) > new Date()) && (() => {
              const hasEntry = Object.prototype.hasOwnProperty.call(badgesMap, p.id);
              const codes = badgesMap[p.id] ?? [];
              // Show skeleton only while the initial batch is in-flight AND
              // this profile hasn't been resolved yet. Once resolved (even to
              // an empty list), we render the final state to avoid flicker.
              if (!hasEntry && badgesLoading) {
                return (
                  <div className="absolute left-1.5 top-1.5">
                    <BadgeStrip codes={[]} max={3} size="xs" loading />
                  </div>
                );
              }
              if (codes.length === 0 || badgesError) return null;
              return (
                <div className="absolute left-1.5 top-1.5">
                  <BadgeStrip codes={codes} max={3} size="xs" />
                </div>
              );
            })()}
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
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 px-1.5 pb-1 text-left">
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-[12px] font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  <PresenceDot
                    online={online}
                    traveler={
                      !!p.travel_city && (!p.travel_until || new Date(p.travel_until) > new Date())
                    }
                    className="size-2"
                  />

                  <span className="truncate">
                    {p.display_name}
                    {age ? <span className="font-normal text-white/75">, {age}</span> : null}
                  </span>
                </p>
                {p.distance_m != null && (
                  <p className="truncate text-[10px] leading-tight text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {formatDistance(p.distance_m)}
                  </p>
                )}
              </div>
              <PositionTag value={p.position} size="sm" />
            </div>

          </button>
        );
      })}
    </div>
  );
}

function PosterRow({
  title,
  emoji,
  profiles,
  onOpen,
}: {
  title: string;
  emoji?: string;
  profiles: DiscoverProfile[];
  onOpen: (p: DiscoverProfile) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const { bySender } = useUnreadMessages();
  useEffect(() => {
    const paths = profiles.map((p) => p.photos?.[0]).filter(Boolean) as string[];
    if (paths.length) signPhotos(paths).then(setUrls);
  }, [profiles]);
  if (!profiles.length) return null;
  return (
    <section className="pt-5">
      <header className="mb-2 flex items-baseline justify-between px-4">
        <h2 className="text-xl font-bold tracking-tight">
          {title} {emoji && <span aria-hidden>{emoji}</span>}
        </h2>
        <span className="text-xs font-medium text-primary/90">{profiles.length} online</span>
      </header>
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {profiles.map((p) => {
          const path = p.photos?.[0];
          const url = path ? urls[path] : null;
          const online = isOnline(p.last_seen);
          const age = ageFrom(p.birthdate);
          const unread = bySender[p.id] ?? 0;
          const traveler =
            p.travel_city && (!p.travel_until || new Date(p.travel_until) > new Date());
          return (
            <button
              key={p.id}
              onClick={() => onOpen(p)}
              className={cn(
                "group relative aspect-[2/3] w-[42vw] max-w-[180px] shrink-0 snap-start overflow-hidden rounded-2xl bg-surface text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                unread > 0 && "snake-border",
              )}
            >
              {url ? (
                <SmartImage
                  src={url}
                  alt={p.display_name ?? ""}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-active:scale-[0.97]"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-3xl text-muted-foreground/40">
                  {p.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              {traveler && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  <Plane className="size-3" /> {p.travel_city}
                </span>
              )}
              {p.boost_until && new Date(p.boost_until) > new Date() && (
                <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-primary/95 px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-lg backdrop-blur">
                  <Rocket className="size-2.5" /> BOOST
                </span>
              )}
              {p.looking_now_until && new Date(p.looking_now_until) > new Date() && (
                <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-rose-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-lg backdrop-blur">
                  <Flame className="size-2.5" /> NOW
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-2.5">
                <div className="flex items-center gap-1.5">
                  <PresenceDot online={online} traveler={!!traveler} className="size-2" />

                  <p className="truncate text-sm font-semibold leading-tight text-white">
                    {p.display_name}
                    {age ? <span className="font-normal text-white/70">, {age}</span> : null}
                  </p>
                </div>
                {p.distance_m != null && (
                  <p className="text-[10px] text-white/70">{formatDistance(p.distance_m)}</p>
                )}
              </div>
              {p.verified && !p.boost_until && (
                <span className="absolute left-2 top-2 rounded-full bg-black/60 p-0.5 backdrop-blur">
                  <BadgeCheck className="size-3.5 text-[var(--verified)]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProfileSheet({
  profile,
  allProfiles,
  currentUserId,
  decision,
  onClose,
  onNavigate,
  onDecision,
  onMessage,
}: {
  profile: DiscoverProfile | null;
  allProfiles: DiscoverProfile[];
  currentUserId: string | null;
  /** Decizia deja luată pentru profilul afișat, dacă există. */
  decision?: DecisionAction;
  onClose: () => void;
  onNavigate: (p: DiscoverProfile) => void;
  onDecision: (p: DiscoverProfile, a: "like" | "pass" | "super") => void;
  onMessage: (p: DiscoverProfile) => void;
}) {
  // Init sincron din cache: dacă poza a fost deja semnată pentru grilă,
  // apare instant, fără flash de gol.
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    peekPhotos(profile?.photos ?? []),
  );
  const sheetLabel = useOptionLabel();
  const liked = decision === "like" || decision === "super";

  useEffect(() => {
    if (!profile?.photos?.length) {
      setUrls({});
      return;
    }
    setUrls(peekPhotos(profile.photos));
    signPhotos(profile.photos).then((next) => setUrls((prev) => ({ ...prev, ...next })));
  }, [profile]);


  const currentIndex = profile ? allProfiles.findIndex((p) => p.id === profile.id) : -1;
  const prev = currentIndex > 0 ? allProfiles[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < allProfiles.length - 1
      ? allProfiles[currentIndex + 1]
      : null;

  // Keyboard nav ←/→
  useEffect(() => {
    if (!profile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prev) onNavigate(prev);
      else if (e.key === "ArrowRight" && next) onNavigate(next);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile, prev, next, onNavigate, onClose]);

  // Touch swipe horizontal to change profile
  const touchStart = useMemo(() => ({ x: 0, y: 0, active: false }), [profile?.id]);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.x = t.clientX;
    touchStart.y = t.clientY;
    touchStart.active = true;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.active) return;
    touchStart.active = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && next) onNavigate(next);
      else if (dx > 0 && prev) onNavigate(prev);
    }
  }

  if (!profile) return null;
  const age = ageFrom(profile.birthdate);
  const photos = profile.photos ?? [];
  const lastSeenText = formatLastSeen(profile.last_seen);
  const online = isOnline(profile.last_seen);
  const heightStr = formatHeight(profile.height_cm);

  const signedPhotos = photos.map((p) => urls[p]).filter(Boolean) as string[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm sm:items-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex h-[100dvh] min-h-0 w-full flex-col border-border bg-surface pt-safe sm:h-[92dvh] sm:max-w-md sm:rounded-t-3xl sm:border sm:pt-0"
      >
        {/* Prev / Next desktop arrows */}
        {prev && (
          <button
            onClick={() => onNavigate(prev)}
            aria-label="Profil anterior"
            className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70 sm:flex"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        {next && (
          <button
            onClick={() => onNavigate(next)}
            aria-label="Profilul următor"
            className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70 sm:flex"
          >
            <ChevronRight className="size-5" />
          </button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ProfilePhotoGallery
          photos={signedPhotos}
          alt={profile.display_name ?? ""}
          topRight={
            <button
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          }
          overlay={
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
              <div className="relative p-5">
                <h2 className="flex items-center gap-2 font-display text-3xl font-medium text-white">
                  {profile.display_name}
                  {age ? <span className="text-white/70">, {age}</span> : null}
                  {profile.verified && <BadgeCheck className="size-5 text-[var(--verified)]" />}
                </h2>
                <PositionTag value={profile.position} />
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        online ? "bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" : "bg-white/40",
                      )}
                    />
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
            </>
          }
        />

        <div className="space-y-5 px-5 pb-6 pt-4">
          {profile.tribes && profile.tribes.length > 0 && (
            <TagBlock label="Tribes" values={profile.tribes} gold />
          )}

          {(profile.body_type ||
            profile.position ||
            profile.ethnicity ||
            profile.relationship_status ||
            profile.weight_kg) && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background/50 p-3 text-xs">
              {profile.body_type && <Stat label="Body" value={profile.body_type} />}
              {profile.position && <Stat label="Position" value={profile.position} />}
              {profile.ethnicity && <Stat label="Ethnicity" value={profile.ethnicity} />}
              {profile.weight_kg && <Stat label="Weight" value={`${profile.weight_kg} kg`} />}
              {profile.relationship_status && (
                <Stat label="Status" value={profile.relationship_status} />
              )}
              {/* hiv_status nu mai este expus în Discover (date de sănătate / GDPR Art. 9). */}
            </div>
          )}

          {profile.pronouns?.length ? (
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {profile.pronouns.join(" · ")}
            </p>
          ) : null}

          {profile.bio && (
            <p className="text-sm leading-relaxed text-foreground/90">{profile.bio}</p>
          )}

          {profile.prompts && profile.prompts.length > 0 && (
            <div className="space-y-2">
              {profile.prompts
                .filter((p) => p.question && p.answer)
                .map((p, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-background/40 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-primary">
                      {p.question}
                    </p>
                    <p className="mt-1 text-sm">{p.answer}</p>
                  </div>
                ))}
            </div>
          )}

          {profile.looking_for?.length ? (
            <TagBlock label="Looking for" values={profile.looking_for} />
          ) : null}
          {profile.interests?.length ? (
            <TagBlock label="Interests" values={profile.interests} />
          ) : null}

          {currentUserId && (
            <PrivateAlbumViewer ownerId={profile.id} currentUserId={currentUserId} />
          )}

          {profile.looking_now_until && new Date(profile.looking_now_until) > new Date() && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <Flame className="size-3.5 text-rose-400" />
              <span className="font-medium uppercase tracking-wider">Right now</span>
              {profile.looking_now_intent && (
                <span className="truncate text-rose-100/80">· {profile.looking_now_intent}</span>
              )}
            </div>
          )}

          <TapFavoriteRow targetId={profile.id} targetName={profile.display_name ?? "Anonim"} />

        </div>
        </div>

        {/* Sticky action bar */}
        <div className="z-10 shrink-0 border-t border-border/60 bg-surface/95 px-4 py-2 pb-bar backdrop-blur">
          <div className="flex items-center gap-2">
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
            {/* Like rămâne pe profil, deci butonul este singurul semnal că a
                fost trimis. Un al doilea tap nu mai produce nimic. */}
            <button
              onClick={() => onDecision(profile, "like")}
              disabled={liked}
              aria-pressed={liked}
              data-liked={liked ? "true" : undefined}
              className={cn(
                "flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full text-sm font-medium",
                liked
                  ? "border border-primary/40 bg-primary/10 text-primary"
                  : "bg-primary text-primary-foreground glow-gold",
              )}
            >
              <Heart className={cn("size-4", liked && "fill-current")} />{" "}
              {liked ? "Like trimis" : "Like"}
            </button>
          </div>
          {(prev || next) && (
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Glisează ← / → pentru a naviga între profiluri
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TapFavoriteRow({ targetId, targetName }: { targetId: string; targetName: string }) {
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tapped, setTapped] = useState<TapEmoji | null>(null);

  useEffect(() => {
    isFavorite(targetId)
      .then(setFav)
      .catch(() => {});
    setTapped(null);
  }, [targetId]);

  async function toggleFav() {
    setBusy(true);
    try {
      if (fav) {
        await removeFavorite(targetId);
        setFav(false);
        toast.success("Eliminat din favorite");
      } else {
        await addFavorite(targetId);
        setFav(true);
        toast.success("Adăugat la favorite");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }


  async function tap(emoji: TapEmoji) {
    if (tapped) return;
    setTapped(emoji);
    try {
      await sendTap(targetId, emoji);
      toast.success(`${emoji} trimis lui ${targetName}`);
    } catch (e) {
      setTapped(null);
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Hand className="mr-1 inline size-3" /> Trimite un Tap
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleFav}
            disabled={busy}
            aria-label={fav ? "Elimină de la favorite" : "Adaugă la favorite"}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border transition-colors",
              fav
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-primary",
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
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
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

function EmptyState({
  onRefresh,
  hasLocation,
  hasFilters,
  onResetFilters,
  onExpandDistance,
  currentDistanceKm,
}: {
  onRefresh: () => void;
  hasLocation: boolean;
  hasFilters: boolean;
  onResetFilters?: () => void;
  onExpandDistance?: (km: number) => void;
  currentDistanceKm?: number;
}) {
  if (!hasLocation) {
    return (
      <CenterMessage
        icon={<Compass className="size-8 text-primary" />}
        title="Activează locația"
        desc="Avem nevoie de zonă (aproximativă) ca să-ți arătăm cine e prin apropiere. Dacă n-ai GPS sau ai refuzat permisiunea, poți alege manual orașul — Discover funcționează oricum."
        action={<LocationOnboarding compact onDone={onRefresh} />}
      />
    );
  }
  if (hasFilters) {
    return (
      <CenterMessage
        icon={<Compass className="size-8 text-primary" />}
        title="Filtrele sunt prea stricte"
        desc="Niciun profil nu se potrivește pe filtrele alese. Relaxează vârsta, distanța sau tribes."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {onResetFilters && (
              <Button variant="hero" onClick={onResetFilters}>
                Relaxează filtrele
              </Button>
            )}
            <Button variant="outline" onClick={onRefresh}>
              Reîncarcă
            </Button>
          </div>
        }
      />
    );
  }
  // Nimic în raza curentă — propune progresiv extindere.
  const next = (currentDistanceKm ?? 0) < 50 ? 50 : (currentDistanceKm ?? 0) < 200 ? 200 : 5000;
  const nextLabel = next === 5000 ? "toată țara" : `${next} km`;
  return (
    <CenterMessage
      icon={<Compass className="size-8 text-primary" />}
      title="Nimeni nou prin zonă acum"
      desc="Comunitatea Suzeta crește. Extinde raza ca să vezi cine e mai departe — sau revino în câteva ore."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {onExpandDistance && (
            <Button variant="hero" onClick={() => onExpandDistance(next)}>
              Extinde la {nextLabel}
            </Button>
          )}
          <Button variant="outline" onClick={onRefresh}>
            Reîncarcă
          </Button>
        </div>
      }
    />
  );
}

function CenterMessage({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 pt-32 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-primary/30 bg-surface glow-gold">
        {icon}
      </div>
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
      try {
        if (cacheKey) sessionStorage.setItem(cacheKey, JSON.stringify(res));
      } catch {
        /* ignore */
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI eșuat");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mt-3 inline-flex max-w-full items-start gap-2 rounded-2xl border border-primary/40 bg-black/50 px-3 py-2 text-xs text-white backdrop-blur">
        <span className="font-display text-lg font-medium text-primary leading-none">
          {result.score}
        </span>
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
