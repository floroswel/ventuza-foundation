import { supabase } from "@/integrations/supabase/client";

export type DiscoverFilters = {
  maxDistanceKm: number;
  minAge: number;
  maxAge: number;
  lookingFor: string[];
  gender: string[];
  orientation: string[];
  tribes: string[];
  bodyTypes: string[];
  positions: string[];

  minHeight: number | null;
  maxHeight: number | null;
  onlineOnly: boolean;
  withPhotoOnly: boolean;
  verifiedOnly: boolean;
  lookingNowOnly: boolean;
};

export const DEFAULT_FILTERS: DiscoverFilters = {
  maxDistanceKm: 5000,
  minAge: 18,
  maxAge: 120,
  lookingFor: [],
  gender: [],
  orientation: [],
  tribes: [],
  bodyTypes: [],
  positions: [],

  minHeight: null,
  maxHeight: null,
  onlineOnly: false,
  withPhotoOnly: false,
  verifiedOnly: false,
  lookingNowOnly: false,
};

export type DiscoverProfile = {
  id: string;
  display_name: string | null;
  birthdate: string | null;
  gender: string[] | null;
  pronouns: string[] | null;
  orientation: string[] | null;
  looking_for: string[] | null;
  interests: string[] | null;
  bio: string | null;
  prompts: Array<{ question: string; answer: string }> | null;
  photos: string[] | null;
  last_seen: string;
  tribes: string[] | null;
  body_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  ethnicity: string | null;
  position: string | null;
  // Ventuza nu mai procesează statutul HIV — nici stocare, nici filtre, nici RPC.
  relationship_status: string | null;
  verified: boolean;
  distance_m: number | null;
  score: number;
  boost_until: string | null;
  travel_city: string | null;
  travel_until: string | null;
  looking_now_until: string | null;
  looking_now_intent: string | null;
};

export function ageFrom(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

/**
 * Approximate distance display (anti-triangulation).
 * Server-side already buckets the distance — we render the bucket label,
 * never an exact figure, so 3 readings can't be triangulated into an address.
 */
export function formatDistance(meters: number | null): string {
  if (meters == null) return "În apropiere";
  if (meters <= 500) return "< 1 km";
  if (meters <= 2000) return "~ 2 km";
  if (meters <= 4000) return "~ 4 km";
  if (meters <= 8000) return "~ 8 km";
  if (meters <= 20000) return "~ 20 km";
  if (meters <= 40000) return "~ 40 km";
  if (meters <= 80000) return "~ 80 km";
  return `${Math.round(meters / 10000) * 10} km+`;
}

// Cu heartbeat presence la 45s (usePresenceHeartbeat), un client activ
// împrospătează `last_seen` la fiecare ~45s. Punctul verde reflectă
// activitate reală ≤ 2 min → tolerăm 2 ratări de heartbeat pe network flap.
// Invisible mode (`profiles.hide_online=true`) oprește heartbeat-ul → punctul
// verde dispare natural.
export function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
}

/** Detailed "Active …" formatter à la Grindr / Hinge. */
export function formatLastSeen(lastSeen: string): string {
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Active now";
  if (min < 60) return `Active ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Active ${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Active yesterday";
  if (day < 7) return `Active ${day}d ago`;
  if (day < 30) return `Active ${Math.floor(day / 7)}w ago`;
  return "Active a while ago";
}

export function formatHeight(cm: number | null): string | null {
  if (!cm) return null;
  const totalIn = Math.round(cm / 2.54);
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn % 12;
  return `${cm} cm · ${ft}'${inch}"`;
}

export async function requestAndStoreLocation(): Promise<{ ok: boolean; error?: string }> {
  if (!("geolocation" in navigator)) return { ok: false, error: "Geolocation not supported" };

  const tryGet = (highAccuracy: boolean) =>
    new Promise<GeolocationPosition | GeolocationPositionError>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => resolve(err),
        {
          enableHighAccuracy: highAccuracy,
          maximumAge: 10 * 60 * 1000,
          timeout: highAccuracy ? 12_000 : 20_000,
        },
      );
    });

  // Primul try: high accuracy. Dacă eșuează (timeout/unavailable), retry cu low accuracy.
  let result = await tryGet(true);
  if ("code" in result) {
    // PERMISSION_DENIED (1) → nu are rost retry, userul a refuzat.
    if (result.code === 1) {
      return {
        ok: false,
        error:
          "Ai blocat locația din browser. Deschide setările site-ului (🔒 lângă URL) și pornește Permisiuni → Locație.",
      };
    }
    // POSITION_UNAVAILABLE (2) sau TIMEOUT (3) → retry cu low accuracy
    result = await tryGet(false);
  }

  if ("code" in result) {
    const msg =
      result.code === 2
        ? "Nu am putut obține locația (GPS/Wi-Fi indisponibil). Încearcă în alt loc sau activează Location Services în sistem."
        : result.code === 3
          ? "Locația nu a răspuns la timp. Verifică conexiunea și reîncearcă."
          : result.message || "Locație indisponibilă.";
    return { ok: false, error: msg };
  }

  const pos = result;
  const { error } = await supabase.rpc("update_my_location", {
    lng: pos.coords.longitude,
    lat: pos.coords.latitude,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Local cache pentru rezultatele Discover
// ---------------------------------------------------------------------------
// Motivația: pe telefon utilizatorul intră/iese des din tab-ul Discover, iar
// fiecare intrare declanșa un RPC discover_profiles (rate-limited la 500/oră).
// Ținem ultimul rezultat per (viewer + filtre + sortare) în localStorage cu TTL
// de 3 minute. Dacă e "proaspăt" → returnăm direct din cache, fără RPC. La
// eroare de rate limit, dacă avem cache stale, îl returnăm ca fallback.
//
// NB: cache-ul conține DOAR ce ne întoarce deja RPC-ul (fără coordonate exacte,
// doar distanță bucketizată). Nu introducem date noi sensibile.
const DISCOVER_CACHE_PREFIX = "discover:v1:";
const DISCOVER_CACHE_TTL_MS = 3 * 60 * 1000;
const DISCOVER_CACHE_MAX_KEYS = 8;

type DiscoverCacheEntry = { at: number; data: DiscoverProfile[] };

function discoverCacheKey(
  viewerId: string,
  filters: DiscoverFilters,
  orderMode: "score" | "distance",
): string {
  const norm = {
    o: orderMode,
    d: filters.maxDistanceKm,
    a: [filters.minAge, filters.maxAge],
    lf: [...filters.lookingFor].sort(),
    g: [...filters.gender].sort(),
    or: [...filters.orientation].sort(),
    t: [...filters.tribes].sort(),
    b: [...filters.bodyTypes].sort(),
    p: [...filters.positions].sort(),
    h: [filters.minHeight, filters.maxHeight],
    fl: [
      filters.onlineOnly ? 1 : 0,
      filters.withPhotoOnly ? 1 : 0,
      filters.verifiedOnly ? 1 : 0,
      filters.lookingNowOnly ? 1 : 0,
    ],
  };
  return `${DISCOVER_CACHE_PREFIX}${viewerId}:${JSON.stringify(norm)}`;
}

function readDiscoverCache(key: string): DiscoverCacheEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiscoverCacheEntry;
    if (!parsed || typeof parsed.at !== "number" || !Array.isArray(parsed.data)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDiscoverCache(key: string, data: DiscoverProfile[]) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ at: Date.now(), data } satisfies DiscoverCacheEntry),
    );
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DISCOVER_CACHE_PREFIX)) keys.push(k);
    }
    if (keys.length > DISCOVER_CACHE_MAX_KEYS) {
      const entries = keys
        .map((k) => ({ k, at: readDiscoverCache(k)?.at ?? 0 }))
        .sort((a, b) => a.at - b.at);
      for (const e of entries.slice(0, entries.length - DISCOVER_CACHE_MAX_KEYS)) {
        localStorage.removeItem(e.k);
      }
    }
  } catch {
    /* localStorage plin/dezactivat — cache opțional */
  }
}

export function clearDiscoverCache() {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DISCOVER_CACHE_PREFIX)) toDelete.push(k);
    }
    for (const k of toDelete) localStorage.removeItem(k);
  } catch {
    /* noop */
  }
}

export const DISCOVER_PAGE_SIZE = 50;

export async function fetchDiscover(
  filters: DiscoverFilters,
  orderMode: "score" | "distance",
  options?: { forceRefresh?: boolean; offset?: number; limit?: number },
): Promise<DiscoverProfile[]> {
  const arr = (v: string[]) => (v.length ? v : null);
  const { data: u } = await supabase.auth.getUser();
  const viewerId = u.user?.id;
  if (!viewerId) {
    const e = new Error("Sesiune expirată. Autentifică-te din nou.") as Error & { code: string };
    e.code = "not_authenticated";
    throw e;
  }

  const offset = Math.max(0, options?.offset ?? 0);
  const limit = Math.min(DISCOVER_PAGE_SIZE, Math.max(1, options?.limit ?? DISCOVER_PAGE_SIZE));

  // Cache-ul păstrează DOAR prima pagină (offset=0). Paginile ulterioare merg
  // direct la RPC (sunt cerute doar când userul scrollează, deci sunt puține).
  const cacheKey = discoverCacheKey(viewerId, filters, orderMode);
  if (offset === 0 && !options?.forceRefresh) {
    const cached = readDiscoverCache(cacheKey);
    if (cached && Date.now() - cached.at < DISCOVER_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("discover_profiles", {
    _viewer: viewerId,
    _max_km: filters.maxDistanceKm,
    _min_age: filters.minAge,
    _max_age: filters.maxAge,
    _genders: arr(filters.gender),
    _tribes: arr(filters.tribes),
    _looking_for: arr(filters.lookingFor),
    _limit: limit,
    _offset: offset,
    _looking_now_only: filters.lookingNowOnly,
    _sort: orderMode === "distance" ? "distance" : "smart",
    _tab: "all",
    _orientation: arr(filters.orientation),
    _body: arr(filters.bodyTypes),
    _position: arr(filters.positions),
    _min_height: filters.minHeight,
    _max_height: filters.maxHeight,
    _online_only: filters.onlineOnly,
    _with_photo_only: filters.withPhotoOnly,
    _verified_only: filters.verifiedOnly,
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    const make = (code: string, message: string) => {
      const e = new Error(message) as Error & { code: string };
      e.code = code;
      return e;
    };
    if (msg.includes("discover_rate_limited")) {
      // Dacă avem cache (chiar expirat), îl returnăm în loc de ecran gol.
      const stale = offset === 0 ? readDiscoverCache(cacheKey) : null;
      if (stale) return stale.data;
      throw make(
        "discover_rate_limited",
        "Ai răsfoit prea repede (max 500 profiluri/oră). Reia explorarea peste aproximativ o oră.",
      );
    }
    if (msg.includes("email_not_confirmed")) {
      throw make(
        "email_not_confirmed",
        "Confirmă-ți emailul ca să vezi profilurile din apropiere. Verifică inbox-ul (și Spam).",
      );
    }
    if (msg.includes("age_verification_required")) {
      throw make(
        "age_verification_required",
        "Trebuie să-ți verifici vârsta înainte de a folosi Discover.",
      );
    }
    if (msg.includes("not_authenticated") || msg.includes("forbidden")) {
      throw make("not_authenticated", "Sesiune expirată. Autentifică-te din nou.");
    }
    throw error;
  }
  const result = (data ?? []) as DiscoverProfile[];
  writeDiscoverCache(cacheKey, result);
  return result;
}

export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  const { reportSignedUrlError, reportSignedUrlMissing } = await import("@/lib/media-telemetry");
  const out: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      // Passthrough for full http(s) URLs (demo seed photos)
      if (/^https?:\/\//i.test(p)) {
        out[p] = p;
        return;
      }
      try {
        const { data, error } = await supabase.storage
          .from("profile-photos")
          .createSignedUrl(p, 3600);
        if (error) {
          reportSignedUrlError({ bucket: "profile-photos", path: p, context: "discover", error });
          return;
        }
        if (data?.signedUrl) out[p] = data.signedUrl;
        else reportSignedUrlMissing({ bucket: "profile-photos", path: p, context: "discover" });
      } catch (error) {
        reportSignedUrlError({ bucket: "profile-photos", path: p, context: "discover", error });
      }
    }),
  );
  return out;
}


export async function logProfileView(viewedId: string) {
  await supabase.from("profile_views").insert({
    viewed_id: viewedId,
    viewer_id: (await supabase.auth.getUser()).data.user?.id ?? "",
  } as never);
}
