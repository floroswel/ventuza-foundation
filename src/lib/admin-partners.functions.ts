/**
 * Admin server functions for the Partners + Moderation module.
 *
 * SECURITY: every handler asserts staff/admin via `is_staff` / `is_admin_or_above`.
 * MUTATIONS: every approve/reject/suspend goes through SQL SECURITY DEFINER RPCs
 * (`admin_moderate_item`, `admin_suspend_partner`, `admin_reinstate_partner`) so
 * audit logging happens server-side and policies stay enforceable.
 *
 * AGENTS.md — Regula MODERARE OBLIGATORIE VENUES/EVENTS/OFFERS:
 * niciun venue/event/offer nu devine vizibil în nearby fără `moderation_status='approved'`
 * acordat de staff. Owner-ul nu se poate auto-publica (RLS + trigger).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: staff role required");
}
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin_or_above", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

/* ----------------------------- BUSINESS APPS ----------------------------- */

export const adminListBusinessApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    status: z.enum(["pending", "reviewing", "approved", "rejected", "all"]).default("pending"),
    limit: z.number().int().min(1).max(200).default(50),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any).from("business_applications")
      .select("id, user_id, legal_name, brand_name, entity_type, contact_name, contact_email, contact_phone, status, created_at, updated_at, admin_notes")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      business_name: r.brand_name ?? r.legal_name,
      business_type: r.entity_type,
      reviewed_at: r.updated_at,
      review_notes: r.admin_notes,
    }));

  });

export const adminDecideBusinessApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("business_applications")
      .update({
        status: data.decision,
        admin_notes: data.notes ?? null,
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    // grant_business_role_on_approval trigger handles role grant on approved.
    await (supabaseAdmin as any).from("admin_audit_log").insert({
      actor_id: context.userId,
      action: `business_app_${data.decision}`,
      target_table: "business_applications",
      target_id: data.id,
      after_data: { notes: data.notes },
      severity: data.decision === "rejected" ? "warning" : "info",
    });
    return { ok: true };
  });

/* ------------------------------ PARTNERS LIST ----------------------------- */

export const adminListPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    filter: z.enum(["active", "suspended", "all"]).default("all"),
    search: z.string().max(120).optional(),
    limit: z.number().int().min(1).max(200).default(100),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // user_roles holds the partner role grant
    const { data: roleRows, error: rErr } = await (supabaseAdmin as any).from("user_roles")
      .select("user_id, granted_at").eq("role", "partner").limit(data.limit);
    if (rErr) throw new Error(rErr.message);
    const ids = (roleRows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return [];
    let q = (supabaseAdmin as any).from("profiles")
      .select("id, display_name, partner_suspended_at, partner_suspension_reason")
      .in("id", ids);
    if (data.filter === "active") q = q.is("partner_suspended_at", null);
    if (data.filter === "suspended") q = q.not("partner_suspended_at", "is", null);
    if (data.search) q = q.ilike("display_name", `%${data.search}%`);
    const { data: profs, error: pErr } = await q;
    if (pErr) throw new Error(pErr.message);

    // counts
    const { data: venues } = await (supabaseAdmin as any).from("venues")
      .select("owner_id, id, is_published, moderation_status").in("owner_id", ids);
    const { data: offers } = await (supabaseAdmin as any).from("offers")
      .select("venue_id, id, is_published").in("venue_id", (venues ?? []).map((v: any) => v.id));

    const byOwner: Record<string, { venues: number; published: number; offers: number }> = {};
    for (const id of ids) byOwner[id] = { venues: 0, published: 0, offers: 0 };
    for (const v of venues ?? []) {
      byOwner[v.owner_id].venues += 1;
      if (v.is_published) byOwner[v.owner_id].published += 1;
    }
    const venueToOwner: Record<string, string> = {};
    for (const v of venues ?? []) venueToOwner[v.id] = v.owner_id;
    for (const o of offers ?? []) {
      const owner = venueToOwner[o.venue_id]; if (!owner) continue;
      byOwner[owner].offers += 1;
    }

    return (profs ?? []).map((p: any) => ({
      ...p,
      stats: byOwner[p.id] ?? { venues: 0, published: 0, offers: 0 },
    }));
  });

export const adminSuspendPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_suspend_partner", {
      p_user_id: data.user_id, p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReinstatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_reinstate_partner", {
      p_user_id: data.user_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- MODERATION QUEUE --------------------------- */

export const adminListModerationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: z.enum(["venue", "event", "offer", "all"]).default("all"),
    status: z.enum(["pending", "changes_requested", "rejected", "approved", "all"]).default("pending"),
    limit: z.number().int().min(1).max(200).default(100),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any).from("admin_moderation_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.status !== "all") q = q.eq("moderation_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminGetModerationItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["venue", "event", "offer"]), id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.kind === "venue" ? "venues" : data.kind === "event" ? "events" : "offers";
    const { data: row, error } = await (supabaseAdmin as any).from(table).select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminModerateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: z.enum(["venue", "event", "offer"]),
    id: z.string().uuid(),
    decision: z.enum(["approved", "rejected", "changes_requested"]),
    reason: z.string().max(1000).optional(),
    notification_radius_m: z.number().int().min(100).max(20000).optional(),
    is_official: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_moderate_item", {
      p_kind: data.kind,
      p_id: data.id,
      p_decision: data.decision,
      p_reason: data.reason ?? null,
      p_notification_radius_m: data.notification_radius_m ?? null,
      p_is_official: data.is_official ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- OFFER STATS ------------------------------ */

export const adminOfferStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offer_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claims } = await (supabaseAdmin as any).from("offer_claims")
      .select("id, claimed_at, redeemed_at").eq("offer_id", data.offer_id);
    const total = (claims ?? []).length;
    const redeemed = (claims ?? []).filter((c: any) => c.redeemed_at).length;
    return { total, redeemed };
  });
