import { supabase } from "@/integrations/supabase/client";

/**
 * Prețurile partenerilor vin EXCLUSIV din `app_settings.billing_settings`
 * (vezi AGENTS.md → REGULĂ FACTURARE PARTENERI). Zero hardcode în UI.
 */
export type PartnerPricingRow = {
  code: string;
  name: string;
  description: string | null;
  entitlements: Record<string, unknown> | null;
  sort_order: number;
  monthly_minor: number | null;
  currency: string;
  vat_rate: number;
};

export async function fetchPartnerPricing(): Promise<PartnerPricingRow[]> {
  const { data, error } = await supabase.rpc("public_partner_pricing" as never);
  if (error) throw error;
  return ((data ?? []) as unknown as PartnerPricingRow[]).slice().sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

export function formatPlanPrice(row: PartnerPricingRow): string {
  if (row.monthly_minor == null || row.monthly_minor <= 0) return "Gratuit";
  const major = row.monthly_minor / 100;
  return `${major.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} ${row.currency}/lună`;
}

export function planPerks(row: PartnerPricingRow): string[] {
  const e = (row.entitlements ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof e[k] === "number" ? (e[k] as number) : 0);
  const cap = (n: number) => (n >= 999 ? "nelimitat" : String(n));
  const perks = [
    `${cap(num("max_venues"))} locuri`,
    `${cap(num("max_events"))} evenimente`,
    `${cap(num("max_offers"))} oferte`,
    `${cap(num("max_notifications_per_day"))} notificări/zi`,
  ];
  if (e["badge_verified"] === true) perks.push("Badge verificat");
  if (e["featured_in_nearby"] === true) perks.push("Featured în Nearby");
  if (e["can_create_boost"] === true) perks.push("Boost campanii");
  if (typeof e["push_priority"] === "string" && e["push_priority"] !== "none") {
    perks.push(`Prioritate push: ${e["push_priority"]}`);
  }
  return perks;
}
