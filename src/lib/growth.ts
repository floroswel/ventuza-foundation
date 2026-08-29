/**
 * Retenție + densitate pe oraș + safety check-in.
 *
 * Toate apelurile trec prin RPC-uri SECURITY DEFINER gate-uite server-side
 * (`assert_age_verified`, owner-only). Clientul nu primește niciodată
 * coordonate, doar agregate.
 */
import { supabase } from "@/integrations/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as any)(name, args);

export type WhatsNew = {
  new_7d: number;
  online_now: number;
  events_tonight: number;
};

export async function fetchWhatsNew(): Promise<WhatsNew | null> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) return null;
  const { data, error } = await rpc("whats_new_today");
  if (error || !data) return null;
  return data as WhatsNew;
}

export async function joinCityWaitlist(city: string): Promise<number | null> {
  const { data, error } = await rpc("join_city_waitlist", { _city: city });
  if (error) throw error;
  return typeof data === "number" ? data : null;
}

export async function cityWaitlistCount(city: string): Promise<number> {
  const { data, error } = await rpc("city_waitlist_count", { _city: city });
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export type SafetyCheckin = {
  id: string;
  note: string | null;
  due_at: string;
  status: "pending" | "confirmed" | "cancelled" | "escalated";
};

export async function getActiveCheckin(): Promise<SafetyCheckin | null> {
  const { data, error } = await supabase
    .from("safety_checkins" as never)
    .select("id, note, due_at, status")
    .in("status", ["pending", "escalated"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as unknown as SafetyCheckin;
}

export async function createSafetyCheckin(
  minutes: number,
  note?: string,
): Promise<string | null> {
  const { data, error } = await rpc("create_safety_checkin", {
    _minutes: minutes,
    _note: note ?? null,
  });
  if (error) throw error;
  return (data as string) ?? null;
}

export async function resolveSafetyCheckin(
  id: string,
  status: "confirmed" | "cancelled",
): Promise<void> {
  const { error } = await rpc("resolve_safety_checkin", { _id: id, _status: status });
  if (error) throw error;
}
