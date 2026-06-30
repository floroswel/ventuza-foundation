import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NearbyKind = "venue" | "event" | "offer";

export type NearbyPoint = {
  kind: NearbyKind;
  id: string;
  venue_id: string | null;
  name: string;
  category: string | null;
  description: string | null;
  cover_url: string | null;
  lat: number;
  lng: number;
  starts_at: string | null;
  ends_at: string | null;
  city: string | null;
};

/**
 * Public — fetches points within a ≈5km bucket and its 8 neighbours.
 * The server NEVER receives the user's precise coordinates.
 * Client filters to exact radius and sorts by haversine distance.
 */
export const getNearbyPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucketId: string; kinds?: NearbyKind[] }) => {
    if (!d.bucketId || typeof d.bucketId !== "string") {
      throw new Error("bucketId_required");
    }
    if (!/^-?\d+:-?\d+$/.test(d.bucketId)) throw new Error("bucketId_invalid");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("nearby_points", {
      p_bucket_id: data.bucketId,
      p_kinds: data.kinds ?? ["venue", "event", "offer"],
    });
    if (error) throw new Error(error.message);
    return { points: (rows ?? []) as NearbyPoint[] };
  });


export const claimOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string }) => {
    if (!d.offerId) throw new Error("offerId_required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .rpc("claim_offer", { p_offer_id: data.offerId })
      .single<{ claim_id: string; redemption_code: string }>();
    if (error) throw new Error(error.message);
    return row;
  });

export const getOfferStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .rpc("offer_stats", { p_offer_id: data.offerId })
      .single<{ claim_count: number; redeemed_count: number }>();
    if (error) throw new Error(error.message);
    return row;
  });
