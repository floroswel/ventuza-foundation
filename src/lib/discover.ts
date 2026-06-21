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
  hivStatuses: string[];
  minHeight: number | null;
  maxHeight: number | null;
  onlineOnly: boolean;
  withPhotoOnly: boolean;
  verifiedOnly: boolean;
  lookingNowOnly: boolean;
};

export const DEFAULT_FILTERS: DiscoverFilters = {
  maxDistanceKm: 100,
  minAge: 18,
  maxAge: 60,
  lookingFor: [],
  gender: [],
  orientation: [],
  tribes: [],
  bodyTypes: [],
  positions: [],
  hivStatuses: [],
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
  hiv_status: string | null;
  hiv_test_date: string | null;
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

export function formatDistance(meters: number | null): string {
  if (meters == null) return "Nearby";
  const km = meters / 1000;
  if (km < 1) return `${Math.max(1, Math.round(meters / 100) * 100)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

export function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
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
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.rpc("update_my_location", {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        });
        if (error) resolve({ ok: false, error: error.message });
        else resolve({ ok: true });
      },
      (err) => resolve({ ok: false, error: err.message }),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  });
}

export async function fetchDiscover(
  filters: DiscoverFilters,
  orderMode: "score" | "distance",
): Promise<DiscoverProfile[]> {
  const arr = (v: string[]) => (v.length ? v : (null as unknown as string[] | undefined));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("discover_profiles", {
    max_distance_km: filters.maxDistanceKm,
    min_age: filters.minAge,
    max_age: filters.maxAge,
    looking_for_filter: arr(filters.lookingFor),
    gender_filter: arr(filters.gender),
    orientation_filter: arr(filters.orientation),
    tribes_filter: arr(filters.tribes),
    body_filter: arr(filters.bodyTypes),
    position_filter: arr(filters.positions),
    hiv_filter: arr(filters.hivStatuses),
    min_height: filters.minHeight,
    max_height: filters.maxHeight,
    online_only: filters.onlineOnly,
    with_photo_only: filters.withPhotoOnly,
    verified_only: filters.verifiedOnly,
    looking_now_only: filters.lookingNowOnly,
    order_mode: orderMode,
    result_limit: 60,
  });
  if (error) throw error;
  return (data ?? []) as DiscoverProfile[];
}

export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      // Passthrough for full http(s) URLs (demo seed photos)
      if (/^https?:\/\//i.test(p)) { out[p] = p; return; }
      const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
      if (data?.signedUrl) out[p] = data.signedUrl;
    }),
  );
  return out;
}

export async function logProfileView(viewedId: string) {
  await supabase.from("profile_views").insert({ viewed_id: viewedId, viewer_id: (await supabase.auth.getUser()).data.user?.id ?? "" } as never);
}
