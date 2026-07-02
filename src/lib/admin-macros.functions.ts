// Support Macros — CRUD + insert în thread (staff-only)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: staff role required");
}

export const adminListMacros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("support_macros")
      .select("id, key, title, category, body, lang, active, usage_count, updated_at")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const UpsertIn = z.object({
  id: z.string().uuid().nullable().optional(),
  key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/i),
  title: z.string().min(2).max(200),
  category: z.string().min(2).max(40),
  body: z.string().min(5).max(8000),
  lang: z.string().min(2).max(8).default("ro"),
  active: z.boolean().default(true),
});
export const adminUpsertMacro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertIn.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const payload = {
      key: data.key,
      title: data.title,
      category: data.category,
      body: data.body,
      lang: data.lang,
      active: data.active,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await sa.from("support_macros").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sa.from("support_macros").insert(payload);
      if (error) throw new Error(error.message);
    }
    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: data.id ? "macros.update" : "macros.create",
      target_type: "support_macros",
      target_id: data.id ?? null,
      after_state: { key: data.key, title: data.title },
      severity: "info",
    });
    return { ok: true };
  });

export const adminDeleteMacro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { error } = await sa.from("support_macros").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "macros.delete",
      target_type: "support_macros",
      target_id: data.id,
      severity: "info",
    });
    return { ok: true };
  });

export const adminUseMacro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("increment_macro_usage", { _key: data.key });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// USER-side: submit CSAT on own resolved ticket
export const submitTicketCsat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        score: z.number().int().min(1).max(5),
        feedback: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("submit_ticket_csat", {
      _ticket_id: data.ticketId,
      _score: data.score,
      _feedback: data.feedback ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// STAFF: CSAT aggregate stats
export const adminCsatStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await sa
      .from("support_tickets")
      .select("csat_score")
      .gte("csat_submitted_at", since)
      .not("csat_score", "is", null);
    if (error) throw new Error(error.message);
    const scores: number[] = (data ?? []).map((r: any) => r.csat_score as number);
    const n = scores.length;
    const avg = n ? scores.reduce((a: number, b: number) => a + b, 0) / n : 0;
    const promoters = scores.filter((s: number) => s >= 4).length;
    const detractors = scores.filter((s: number) => s <= 2).length;
    return {
      count: n,
      avg: Number(avg.toFixed(2)),
      csat_pct: n ? Math.round((promoters / n) * 100) : 0,
      detractor_pct: n ? Math.round((detractors / n) * 100) : 0,
    };
  });
