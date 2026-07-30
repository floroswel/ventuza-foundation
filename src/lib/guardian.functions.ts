/**
 * Guardian — server functions (staff only).
 *
 * Gate real server-side: RPC-urile `guardian_*` verifică `is_staff` /
 * `is_admin_or_above` în DB. Aici doar transportăm apelul cu identitatea
 * userului (RLS aplicat), niciodată cu service role.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GuardianIncident = {
  id: string;
  fingerprint: string;
  title: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "mitigated" | "resolved" | "ignored";
  event_count: number;
  users_affected: number;
  first_seen: string;
  last_seen: string;
  probable_cause: string | null;
  proposed_fix: string | null;
  risk: string | null;
  impact: string | null;
  affected_files: string[];
  // jsonb – shape liber, serializat ca JSON
  sample: any;
};

export type GuardianAction = {
  id: string;
  incident_id: string | null;
  action_type: string;
  decision: string;
  status: "pending" | "executed" | "approved" | "rejected" | "rolled_back" | "failed";
  risk: string;
  reversible: boolean;
  summary: string;
  payload: any;
  result: any;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  executed_at: string | null;
  created_at: string;
};

export type GuardianDashboard = {
  generated_at: string;
  window_hours: number;
  totals: { events: number; critical: number; high: number; users_affected: number };
  open_incidents: number;
  resolved_incidents: number;
  by_category: Array<{ category: string; events: number; users: number }>;
  hourly: Array<{ bucket: string; events: number }>;
  incidents: GuardianIncident[];
  actions: GuardianAction[];
  recent_events: Array<{
    id: string;
    severity: string;
    category: string;
    message: string;
    route: string | null;
    app_version: string | null;
    platform: string | null;
    request_id: string | null;
    created_at: string;
  }>;
};

export const guardianGetDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ hours: z.number().int().min(1).max(720).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<GuardianDashboard> => {
    const { data: res, error } = await (context.supabase as any).rpc("guardian_dashboard", {
      _hours: data.hours ?? 24,
    });
    if (error) throw new Error(error.message);
    return res as GuardianDashboard;
  });

export const guardianGetReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ period: z.enum(["daily", "weekly"]) }).parse(d))
  .handler(async ({ data, context }): Promise<any> => {
    const { data: res, error } = await (context.supabase as any).rpc("guardian_report", {
      _period: data.period,
    });
    if (error) throw new Error(error.message);
    return res as any;
  });

export const guardianDecideAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        actionId: z.string().uuid(),
        decision: z.enum(["approve", "reject", "rollback"]),
        reason: z.string().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc("guardian_decide_action", {
      _action_id: data.actionId,
      _decision: data.decision,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return res as GuardianAction;
  });

export const guardianSetIncidentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        incidentId: z.string().uuid(),
        status: z.enum(["open", "mitigated", "resolved", "ignored"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc("guardian_set_incident_status", {
      _incident_id: data.incidentId,
      _status: data.status,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return res as GuardianIncident;
  });

export const guardianProposeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        incidentId: z.string().uuid(),
        actionType: z.string().min(2).max(60),
        decision: z.string().min(1).max(40),
        risk: z.enum(["low", "medium", "high"]),
        reversible: z.boolean(),
        summary: z.string().min(3).max(500),
        payload: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc("guardian_propose_action", {
      _incident_id: data.incidentId,
      _action_type: data.actionType,
      _decision: data.decision,
      _risk: data.risk,
      _reversible: data.reversible,
      _summary: data.summary,
      _payload: data.payload ?? {},
      _auto_executed: false,
    });
    if (error) throw new Error(error.message);
    return { id: res as string };
  });
