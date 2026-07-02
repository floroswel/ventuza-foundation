import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExploreCity = {
  city: string;
  events: number;
  venues: number;
  travelers: number;
  cover_url: string | null;
};

/**
 * Aggregates venues/events/travelers per city.
 * - No user coordinates are exposed; we only count profiles by `travel_city`.
 * - Only approved+published venues/events are counted.
 */
export const getExploreCities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [venuesRes, eventsRes, travelersRes] = await Promise.all([
      sb
        .from("venues")
        .select("city, cover_url")
        .eq("is_published", true)
        .eq("moderation_status", "approved")
        .not("city", "is", null)
        .limit(2000),
      sb
        .from("events")
        .select("city, cover_url")
        .eq("is_published", true)
        .eq("moderation_status", "approved")
        .not("city", "is", null)
        .limit(2000),
      sb.from("profiles").select("travel_city").not("travel_city", "is", null).limit(5000),
    ]);
    const byCity = new Map<string, ExploreCity>();
    const ensure = (c: string) => {
      const key = c.trim();
      if (!key) return null;
      let row = byCity.get(key);
      if (!row) {
        row = { city: key, events: 0, venues: 0, travelers: 0, cover_url: null };
        byCity.set(key, row);
      }
      return row;
    };
    for (const v of venuesRes.data ?? []) {
      const row = ensure(v.city as string);
      if (!row) continue;
      row.venues += 1;
      if (!row.cover_url && v.cover_url) row.cover_url = v.cover_url as string;
    }
    for (const e of eventsRes.data ?? []) {
      const row = ensure(e.city as string);
      if (!row) continue;
      row.events += 1;
      if (!row.cover_url && e.cover_url) row.cover_url = e.cover_url as string;
    }
    for (const p of travelersRes.data ?? []) {
      const row = ensure(p.travel_city as string);
      if (!row) continue;
      row.travelers += 1;
    }
    return Array.from(byCity.values()).sort(
      (a, b) => b.events + b.venues + b.travelers - (a.events + a.venues + a.travelers),
    );
  });
