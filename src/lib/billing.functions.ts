/**
 * Partner billing — bank transfer (OP) flow.
 *
 * - No external payment processors. Bank receives B2B transfer only.
 * - Invoice numbering through SECURITY DEFINER `next_invoice_number` (no gaps, per year/series).
 * - Subscription activates/extends ONLY through `admin_confirm_invoice_payment` (audited).
 * - Prices + VAT come from `app_settings.billing_settings` (no hardcode).
 *
 * AGENTS.md → REGULĂ — FACTURARE PARTENERI.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertPartner({ supabase, userId }: Ctx) {
  const { data: isBiz } = await supabase.rpc("has_role", { _user_id: userId, _role: "business" });
  if (!isBiz) throw new Error("forbidden: not a partner");
  const { data: prof } = await supabase.from("profiles").select("partner_suspended_at").eq("id", userId).maybeSingle();
  if (prof?.partner_suspended_at) throw new Error("suspended");
}

export const partnerListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("partner_plans").select("*").eq("active", true).order("sort_order");
    if (error) throw new Error(error.message);
    const { data: settings } = await (context.supabase as any)
      .from("app_settings").select("value").eq("key", "billing_settings").maybeSingle();
    return { plans: data ?? [], settings: settings?.value ?? null };
  });

export const partnerGetMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("partner_subscriptions").select("*").eq("owner_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    const { data: ent } = await (context.supabase as any)
      .rpc("partner_active_entitlements", { _owner_id: context.userId });
    return { subscription: data, entitlements: ent ?? {} };
  });

export const partnerListMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("partner_invoices").select("*").eq("owner_id", context.userId).order("issued_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return { invoices: data ?? [] };
  });

export const partnerStartSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_code: z.enum(["Pro", "Premium"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPartner(context);
    // Block if billing data incomplete
    const { data: ba } = await (context.supabase as any)
      .from("business_applications")
      .select("billing_completed_at, billing_email")
      .eq("user_id", context.userId).eq("status", "approved")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!ba?.billing_completed_at || !ba?.billing_email) {
      throw new Error("billing_incomplete: completează datele de facturare înainte de upgrade");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invId, error } = await (supabaseAdmin as any).rpc("partner_create_invoice", {
      _owner_id: context.userId,
      _kind: "subscription",
      _plan_code: data.plan_code,
      _boost_event_id: null,
      _boost_price_minor: null,
    });
    if (error) throw new Error(error.message);
    const { data: inv } = await (supabaseAdmin as any).from("partner_invoices").select("*").eq("id", invId).maybeSingle();
    return { invoice: inv };
  });

export const partnerOrderBoost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ event_id: z.string().uuid(), price_minor: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPartner(context);
    // Check can_create_boost entitlement
    const { data: ent } = await (context.supabase as any).rpc("partner_active_entitlements", { _owner_id: context.userId });
    if (!ent?.can_create_boost) throw new Error("plan_does_not_allow_boost");
    // Verify event ownership
    const { data: ev } = await (context.supabase as any)
      .from("events").select("id,host_id").eq("id", data.event_id).maybeSingle();
    if (!ev || ev.host_id !== context.userId) throw new Error("event_not_owned");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invId, error } = await (supabaseAdmin as any).rpc("partner_create_invoice", {
      _owner_id: context.userId,
      _kind: "boost",
      _plan_code: null,
      _boost_event_id: data.event_id,
      _boost_price_minor: data.price_minor,
    });
    if (error) throw new Error(error.message);
    const { data: inv } = await (supabaseAdmin as any).from("partner_invoices").select("*").eq("id", invId).maybeSingle();
    return { invoice: inv };
  });

export const partnerUpdateBillingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      iban: z.string().trim().max(40).optional().nullable(),
      billing_email: z.string().trim().email().max(120),
      is_vat_payer: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPartner(context);
    const { error } = await (context.supabase as any)
      .from("business_applications")
      .update({
        iban: data.iban || null,
        billing_email: data.billing_email,
        is_vat_payer: data.is_vat_payer,
        billing_completed_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId).eq("status", "approved");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
