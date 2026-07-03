import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getUserBadgesBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userIds: string[] }) => {
    if (!Array.isArray(d.userIds)) throw new Error("userIds_required");
    const clean = Array.from(new Set(d.userIds.filter((x) => typeof x === "string" && x.length > 0))).slice(0, 100);
    return { userIds: clean };
  })
  .handler(async ({ data, context }) => {
    if (data.userIds.length === 0) return { rows: [] as Array<{ user_id: string; badges: string[] }> };
    const { data: rows, error } = await context.supabase.rpc("get_user_badges_batch", {
      _user_ids: data.userIds,
    });
    if (error) return { rows: [] as Array<{ user_id: string; badges: string[] }> };
    return { rows: (rows ?? []) as Array<{ user_id: string; badges: string[] }> };
  });

export const getVenueBadgesBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { venueIds: string[] }) => {
    if (!Array.isArray(d.venueIds)) throw new Error("venueIds_required");
    const clean = Array.from(new Set(d.venueIds.filter((x) => typeof x === "string" && x.length > 0))).slice(0, 100);
    return { venueIds: clean };
  })
  .handler(async ({ data, context }) => {
    if (data.venueIds.length === 0) return { rows: [] as Array<{ venue_id: string; badges: string[] }> };
    const { data: rows, error } = await context.supabase.rpc("get_venue_badges_batch", {
      _venue_ids: data.venueIds,
    });
    if (error) return { rows: [] as Array<{ venue_id: string; badges: string[] }> };
    return { rows: (rows ?? []) as Array<{ venue_id: string; badges: string[] }> };
  });
