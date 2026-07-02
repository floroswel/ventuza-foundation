import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const upsertSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9_.-]+$/i),
  category: z.string().min(2).max(40),
  title: z.string().min(3).max(160),
  description: z.string().max(2000).optional().default(""),
  expression: z.record(z.string(), z.unknown()).default({}),
  action: z.record(z.string(), z.unknown()).default({}),
  changeNote: z.string().max(500).optional(),
});

export const policyListRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("policy_rules")
      .select(
        "id,code,category,title,description,state,version,expression,action,updated_at,updated_by",
      )
      .order("category", { ascending: true })
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const policyListVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ruleId: string }) => z.object({ ruleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("policy_rule_versions")
      .select("id,version,state,expression,action,changed_by,change_note,created_at")
      .eq("rule_id", data.ruleId)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const policyUpsertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await (context.supabase.rpc as any)("policy_upsert_rule", {
      p_code: data.code,
      p_category: data.category,
      p_title: data.title,
      p_description: data.description ?? "",
      p_expression: data.expression,
      p_action: data.action,
      p_change_note: data.changeNote ?? null,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const policySetState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ruleId: z.string().uuid(),
        state: z.enum(["draft", "shadow", "enforcing", "archived"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("policy_set_state", {
      p_rule_id: data.ruleId,
      p_new_state: data.state,
      p_note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const policySimulate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ruleCode: z.string().min(1),
        days: z.number().int().min(1).max(90).default(7),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("policy_simulate", {
      p_rule_code: data.ruleCode,
      p_days: data.days,
    });
    if (error) throw new Error(error.message);
    const r = Array.isArray(rows) ? rows[0] : rows;
    return {
      total: Number(r?.total ?? 0),
      matched: Number(r?.matched ?? 0),
      matchRate: Number(r?.match_rate ?? 0),
      byDay: (r?.by_day as Array<{ day: string; total: number; matched: number }>) ?? [],
    };
  });

export const policyRecentEvaluations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ruleCode: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("policy_evaluations")
      .select("id,rule_version,mode,subject_kind,subject_id,matched,action_taken,created_at")
      .eq("rule_code", data.ruleCode)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
