import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  windowHours: z.number().int().min(1).max(168).optional(),
});

export type RateLimitStats = {
  window_hours: number;
  generated_at: string;
  per_action: Array<{
    action: string;
    total: number;
    unique_users: number;
    last_seen: string | null;
    last_hour_hits: number;
    last_hour_uniques: number;
  }>;
  hourly: Array<{ action: string; bucket: string; hits: number; uniques: number }>;
  top_offenders: Array<{
    user_id: string;
    display_name: string | null;
    action: string;
    hits: number;
    last_seen: string;
    banned_at: string | null;
    suspended_until: string | null;
  }>;
  throttled_now: Array<{
    user_id: string;
    display_name: string | null;
    hits: number;
    last_hit: string;
  }>;
  spikes: Array<{
    action: string;
    bucket: string;
    hits: number;
    uniques: number;
    avg_hits: number;
  }>;
};

export const adminGetRateLimitStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<RateLimitStats> => {
    const { data: result, error } = await (context.supabase as any).rpc(
      "admin_rate_limit_stats",
      { _window_hours: data.windowHours ?? 24 },
    );
    if (error) throw new Error(error.message);
    return result as RateLimitStats;
  });
