import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  windowHours: z.number().int().min(1).max(168).optional(),
});

export type SignupThrottleStats = {
  window_hours: number;
  generated_at: string;
  caps: { ip_per_hour: number; ip_per_day: number; fp_per_hour: number; fp_per_day: number };
  totals: {
    attempts: number;
    unique_ips: number;
    unique_fps: number;
    blocked_ips: number;
    blocked_fps: number;
    blocks_logged: number;
  };
  blocks_by_reason: Partial<
    Record<"ip_hourly_cap" | "ip_daily_cap" | "fp_hourly_cap" | "fp_daily_cap", number>
  >;
  recent_blocks: Array<{
    reason: "ip_hourly_cap" | "ip_daily_cap" | "fp_hourly_cap" | "fp_daily_cap";
    ip_hash_prefix: string | null;
    fp_prefix: string | null;
    ip_hour: number;
    ip_day: number;
    fp_hour: number;
    fp_day: number;
    created_at: string;
  }>;
  top_ips: Array<{
    ip_hash: string;
    total: number;
    last_hour: number;
    last_day: number;
    last_seen: string;
    blocked_reason: "ip_hourly_cap" | "ip_daily_cap" | null;
  }>;
  top_fingerprints: Array<{
    fingerprint: string;
    total: number;
    last_hour: number;
    last_day: number;
    last_seen: string;
    blocked_reason: "fp_hourly_cap" | "fp_daily_cap" | null;
  }>;
  hourly: Array<{ bucket: string; hits: number; unique_ips: number; unique_fps: number }>;
};

export const adminGetSignupThrottleStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SignupThrottleStats> => {
    const { data: result, error } = await (context.supabase as any).rpc(
      "admin_signup_throttle_stats",
      { _window_hours: data.windowHours ?? 24 },
    );
    if (error) throw new Error(error.message);
    return result as SignupThrottleStats;
  });
