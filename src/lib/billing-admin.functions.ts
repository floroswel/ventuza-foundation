/**
 * Admin billing — list invoices, confirm payment manually, revenue summary,
 * edit billing_settings (issuer, prices, VAT, grace).
 *
 * RBAC: is_staff (moderator+) for read; admin+ for write/confirm; super_admin for settings.
 * Every write goes through SECURITY DEFINER RPCs that write to admin_audit_log.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireStaff(ctx: { supabase: any; userId: string }) {
  const { data: ok } = await ctx.supabase.rpc("is_staff", { _user_id: ctx.userId });
  if (!ok) throw new Error("forbidden");
}

export const adminListInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      status: z.string().optional(),
      owner_id: z.string().uuid().optional(),
      from: z.string().optional(),
      until: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any).from("partner_invoices").select("*").order("issued_at", { ascending: false }).limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.owner_id) q = q.eq("owner_id", data.owner_id);
    if (data.from) q = q.gte("issued_at", data.from);
    if (data.until) q = q.lte("issued_at", data.until);
    if (data.search) q = q.or(`payment_code.ilike.%${data.search}%,paid_ref.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { invoices: rows ?? [] };
  });

export const adminGetInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await (supabaseAdmin as any).from("partner_invoices").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return { invoice: inv };
  });

export const adminConfirmInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      invoice_id: z.string().uuid(),
      amount_minor: z.number().int().positive(),
      paid_ref: z.string().trim().min(1).max(200),
      paid_at: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { error } = await (context.supabase as any).rpc("admin_confirm_invoice_payment", {
      _invoice_id: data.invoice_id,
      _amount_minor: data.amount_minor,
      _paid_ref: data.paid_ref,
      _paid_at: data.paid_at ?? new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCancelInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ invoice_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { error } = await (context.supabase as any).rpc("admin_cancel_invoice", {
      _invoice_id: data.invoice_id, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRevenueSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const [{ data: paidMonth }, { data: pending }, { data: overdue }, { data: subs }] = await Promise.all([
      (supabaseAdmin as any).from("partner_invoices").select("total_minor,paid_amount_minor").eq("status", "paid").gte("paid_at", monthStart.toISOString()),
      (supabaseAdmin as any).from("partner_invoices").select("total_minor").eq("status", "pending_payment"),
      (supabaseAdmin as any).from("partner_invoices").select("total_minor").eq("status", "overdue"),
      (supabaseAdmin as any).from("partner_subscriptions").select("plan_code,status"),
    ]);
    const sumMinor = (rows: any[] | null, key: string) => (rows ?? []).reduce((a, r) => a + (r[key] ?? 0), 0);
    const byPlan: Record<string, number> = {};
    (subs ?? []).forEach((s: any) => {
      if (s.status === "active" || s.status === "grace") byPlan[s.plan_code] = (byPlan[s.plan_code] ?? 0) + 1;
    });
    return {
      paid_month_minor: sumMinor(paidMonth, "paid_amount_minor"),
      pending_minor: sumMinor(pending, "total_minor"),
      overdue_minor: sumMinor(overdue, "total_minor"),
      pending_count: pending?.length ?? 0,
      overdue_count: overdue?.length ?? 0,
      partners_by_plan: byPlan,
    };
  });

export const adminGetBillingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { data } = await (context.supabase as any).from("app_settings").select("value,updated_at").eq("key", "billing_settings").maybeSingle();
    return { settings: data?.value ?? null, updated_at: data?.updated_at ?? null };
  });

export const adminUpdateBillingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ value: z.any() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId, _roles: ["admin", "super_admin"],
    });
    if (!isAdmin) throw new Error("forbidden: admin required");
    const { error } = await (context.supabase as any).rpc("admin_update_setting", {
      _key: "billing_settings", _value: data.value, _description: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRunBillingTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId, _roles: ["admin", "super_admin"],
    });
    if (!isAdmin) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("billing_tick");
    if (error) throw new Error(error.message);
    return { result: data };
  });
