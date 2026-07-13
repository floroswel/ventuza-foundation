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
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["pending", "reviewing", "approved", "rejected", "all"]).default("pending"),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("business_applications")
      .select(
        "id, user_id, legal_name, brand_name, entity_type, contact_name, contact_email, contact_phone, status, created_at, updated_at, admin_notes",
      )
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
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        notes: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("business_applications")
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
  .inputValidator((d: unknown) =>
    z
      .object({
        filter: z.enum(["active", "suspended", "all"]).default("all"),
        search: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Rolul de partener este `business` (vezi grant_business_role_on_approval +
    // PartnerAccessGate). Includem și `partner` pentru compat legacy.
    const { data: roleRows, error: rErr } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["business", "partner"])
      .limit(data.limit);
    if (rErr) throw new Error(rErr.message);
    const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id))) as string[];
    if (ids.length === 0) return [];
    let q = (supabaseAdmin as any)
      .from("profiles")
      .select("id, display_name, partner_suspended_at, partner_suspension_reason")
      .in("id", ids);
    if (data.filter === "active") q = q.is("partner_suspended_at", null);
    if (data.filter === "suspended") q = q.not("partner_suspended_at", "is", null);
    if (data.search) q = q.ilike("display_name", `%${data.search}%`);
    const { data: profs, error: pErr } = await q;
    if (pErr) throw new Error(pErr.message);

    // entity_type din cea mai recentă aplicație aprobată per user
    const { data: apps } = await (supabaseAdmin as any)
      .from("business_applications")
      .select("user_id, entity_type, updated_at")
      .in("user_id", ids)
      .eq("status", "approved")
      .order("updated_at", { ascending: false });
    const entityByUser: Record<string, string> = {};
    for (const a of apps ?? []) {
      if (!entityByUser[a.user_id]) entityByUser[a.user_id] = a.entity_type;
    }

    // counts
    const { data: venues } = await (supabaseAdmin as any)
      .from("venues")
      .select("owner_id, id, is_published, moderation_status")
      .in("owner_id", ids);
    const { data: offers } = await (supabaseAdmin as any)
      .from("offers")
      .select("venue_id, id, is_published")
      .in(
        "venue_id",
        (venues ?? []).map((v: any) => v.id),
      );

    const byOwner: Record<string, { venues: number; published: number; offers: number }> = {};
    for (const id of ids) byOwner[id] = { venues: 0, published: 0, offers: 0 };
    for (const v of venues ?? []) {
      byOwner[v.owner_id].venues += 1;
      if (v.is_published) byOwner[v.owner_id].published += 1;
    }
    const venueToOwner: Record<string, string> = {};
    for (const v of venues ?? []) venueToOwner[v.id] = v.owner_id;
    for (const o of offers ?? []) {
      const owner = venueToOwner[o.venue_id];
      if (!owner) continue;
      byOwner[owner].offers += 1;
    }

    return (profs ?? []).map((p: any) => ({
      ...p,
      entity_type: entityByUser[p.id] ?? null,
      stats: byOwner[p.id] ?? { venues: 0, published: 0, offers: 0 },
    }));
  });

/* ---------------------- MANUAL GRANT / REVOKE PARTNER --------------------- */

const ENTITY_TYPES = [
  "srl",
  "pfa",
  "ii",
  "sa",
  "ong",
  "asociatie",
  "fundatie",
  "brand",
  "organizator_eveniment",
  "altul",
] as const;

/**
 * Acordare manuală a rolului de partener din admin.
 * Refolosește fluxul existent: creează o business_application marcată aprobată,
 * pentru ca trigger-ul `grant_business_role_on_approval` să acorde rolul
 * exact ca la fluxul normal. Trigger-ul se declanșează DOAR pe UPDATE, așa că
 * inserăm cu status='pending' și facem imediat UPDATE la 'approved'.
 */
export const adminGrantPartnerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        entity_type: z.enum(ENTITY_TYPES),
        reason: z.string().min(10).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, display_name")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!prof) throw new Error("Utilizator inexistent.");

    const { data: authUser, error: aErr } = await (supabaseAdmin as any).auth.admin.getUserById(
      data.user_id,
    );
    if (aErr || !authUser?.user) throw new Error("Nu am putut citi contul auth al userului.");
    const email = authUser.user.email ?? `user-${data.user_id}@unknown.local`;
    const displayName = (prof.display_name as string) || email;

    const insertRow = {
      user_id: data.user_id,
      entity_type: data.entity_type,
      legal_name: displayName,
      contact_name: displayName,
      contact_email: email,
      goals: `Acordat manual din admin. Motiv: ${data.reason}`,
      accepts_terms: true,
      accepts_dpa: true,
      accepts_lgbt_charter: true,
      status: "pending" as const,
      admin_notes: `manual_grant_by=${context.userId}`,
    };
    const { data: inserted, error: insErr } = await (supabaseAdmin as any)
      .from("business_applications")
      .insert(insertRow)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // UPDATE → declanșează trigger-ul care acordă rolul `business`.
    const { error: updErr } = await (supabaseAdmin as any)
      .from("business_applications")
      .update({
        status: "approved",
        admin_notes: `manual_grant_by=${context.userId}: ${data.reason}`,
      })
      .eq("id", inserted.id);
    if (updErr) throw new Error(updErr.message);

    await (supabaseAdmin as any).from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "partner_granted_manually",
      target_table: "profiles",
      target_id: data.user_id,
      justification: data.reason,
      after_data: { entity_type: data.entity_type, business_application_id: inserted.id },
      severity: "warning",
    });
    return { ok: true, business_application_id: inserted.id };
  });

/**
 * Retrage rolul de partener acordat manual sau prin aplicație.
 * NU șterge business_applications — doar revocă rolul din `user_roles`.
 */
export const adminRevokePartnerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        reason: z.string().min(10).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .in("role", ["business", "partner"]);
    if (!existing || existing.length === 0) {
      throw new Error("Userul nu are rol de partener.");
    }

    const { error: delErr } = await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .in("role", ["business", "partner"]);
    if (delErr) throw new Error(delErr.message);

    await (supabaseAdmin as any).from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "partner_revoked_manually",
      target_table: "profiles",
      target_id: data.user_id,
      justification: data.reason,
      before_data: { roles: existing.map((r: any) => r.role) },
      severity: "warning",
    });
    return { ok: true };
  });

export const adminSuspendPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("admin_suspend_partner", {
      p_user_id: data.user_id,
      p_reason: data.reason,
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
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["venue", "event", "offer", "all"]).default("all"),
        status: z
          .enum(["pending", "changes_requested", "rejected", "approved", "all"])
          .default("pending"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("admin_moderation_queue")
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
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["venue", "event", "offer"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.kind === "venue" ? "venues" : data.kind === "event" ? "events" : "offers";
    const { data: row, error } = await (supabaseAdmin as any)
      .from(table)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminModerateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["venue", "event", "offer"]),
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "changes_requested"]),
        reason: z.string().max(1000).optional(),
        notification_radius_m: z.number().int().min(100).max(20000).optional(),
        is_official: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    // Paritate strictă cu restul funcțiilor admin: MFA obligatoriu pentru
    // ORICE decizie de moderare (aprobare/respingere/changes_requested),
    // indiferent de rază sau `is_official`. Moderarea afectează
    // vizibilitatea publică + notificări push.
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);
    // Folosim clientul autentificat, nu supabaseAdmin, ca `auth.uid()` să fie
    // populat în RPC-ul SECURITY DEFINER (verifică `is_staff(auth.uid())` intern).
    const { error } = await context.supabase.rpc("admin_moderate_item", {
      p_kind: data.kind,
      p_id: data.id,
      p_decision: data.decision,
      p_reason: data.reason ?? undefined,
      p_notification_radius_m: data.notification_radius_m ?? undefined,
      p_is_official: data.is_official ?? undefined,
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
    const { data: claims } = await (supabaseAdmin as any)
      .from("offer_claims")
      .select("id, claimed_at, redeemed_at")
      .eq("offer_id", data.offer_id);
    const total = (claims ?? []).length;
    const redeemed = (claims ?? []).filter((c: any) => c.redeemed_at).length;
    return { total, redeemed };
  });
