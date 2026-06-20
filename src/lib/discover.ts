import { supabase } from "@/integrations/supabase/client";

export type DiscoverFilters = {
  maxDistanceKm: number;
  minAge: number;
  maxAge: number;
  lookingFor: string[];
  gender: string[];
  orientation: string[];
};

export const DEFAULT_FILTERS: DiscoverFilters = {
  maxDistanceKm: 100,
  minAge: 18,
  maxAge: 60,
  lookingFor: [],
  gender: [],
  orientation: [],
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
  distance_m: number | null;
  score: number;
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
  const { data, error } = await supabase.rpc("discover_profiles", {
    max_distance_km: filters.maxDistanceKm,
    min_age: filters.minAge,
    max_age: filters.maxAge,
    looking_for_filter: filters.lookingFor.length ? filters.lookingFor : (null as unknown as string[] | undefined),
    gender_filter: filters.gender.length ? filters.gender : (null as unknown as string[] | undefined),
    orientation_filter: filters.orientation.length ? filters.orientation : (null as unknown as string[] | undefined),
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
      const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
      if (data?.signedUrl) out[p] = data.signedUrl;
    }),
  );
  return out;
}
