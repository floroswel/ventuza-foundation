import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  windowHours: z.number().int().min(1).max(168).optional(),
});

export type SecuritySignals = {
  window_hours: number;
  generated_at: string;
  summary: {
    signups_total: number;
    signups_last_hour: number;
    signups_prev_hour: number;
    signups_avg_per_hour: number;
    reports_last_hour: number;
    reports_prev_hour: number;
    high_risk_count: number;
    duplicate_fingerprint_count: number;
  };
  alerts: Array<{ kind: string; severity: "high" | "medium" | "low"; message: string }>;
  signups_hourly: Array<{ bucket: string; count: number }>;
  high_risk_users: Array<{
    user_id: string;
    display_name: string | null;
    risk_score: number;
    created_at: string;
    banned_at: string | null;
  }>;
  duplicate_fingerprints: Array<{
    fingerprint: string;
    user_count: number;
    last_seen: string;
  }>;
  recent_accounts: Array<{
    user_id: string;
    display_name: string | null;
    risk_score: number | null;
    created_at: string;
    age_status: string | null;
  }>;
};

export const adminGetSecuritySignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SecuritySignals> => {
    const { data: result, error } = await (context.supabase as any).rpc(
      "admin_security_signals",
      { _window_hours: data.windowHours ?? 24 },
    );
    if (error) throw new Error(error.message);
    return result as SecuritySignals;
  });
