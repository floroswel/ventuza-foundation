import { supabase } from "@/integrations/supabase/client";
import type { City } from "@/lib/cities";

export type TravelStatus = {
  city: string;
  until: string; // ISO
  setAt: string | null;
} | null;

/** Modul Explorer expiră singur; maximul acceptat de DB este 24h. */
export const EXPLORER_MAX_HOURS = 24;

export async function getMyTravelStatus(): Promise<TravelStatus> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("travel_city, travel_until, travel_set_at")
    .eq("id", uid)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { travel_city: string | null; travel_until: string | null; travel_set_at?: string | null };
  if (!row.travel_city || !row.travel_until) return null;
  if (new Date(row.travel_until).getTime() <= Date.now()) return null;
  return { city: row.travel_city, until: row.travel_until, setAt: row.travel_set_at ?? null };
}

export async function setTravelLocation(city: City, hours = EXPLORER_MAX_HOURS) {
  const label = `${city.name}, ${city.country}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("set_travel_location", {
    _lat: city.lat,
    _lng: city.lng,
    _city: label,
    _hours: Math.min(Math.max(1, Math.round(hours)), EXPLORER_MAX_HOURS),
  });
  if (error) throw error;
}

export async function clearTravelLocation() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("clear_travel_location", {});
  if (error) throw error;
}

/** „mai 7 h 20 m" — text scurt pentru indicatorul permanent. */
export function formatRemaining(untilIso: string): string {
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return "expirat";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, "0")} m`;
}
