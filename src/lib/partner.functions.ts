/**
 * Partner portal server functions.
 *
 * SECURITY:
 * - Every handler enforces `assertPartner` (has 'business' role + not suspended).
 * - All listings go through `(context.supabase as any)` so owner-only RLS applies.
 * - Create/update strip `is_published`, `is_official`, `moderation_status`,
 *   `moderated_*` from input. The DB triggers (*_no_self_publish) enforce this
 *   too, but we never even let it reach SQL.
 * - Updating an already-approved item resets it to `pending` + `is_published=false`.
 * - Server-side quota enforcement before insert + rate-limit on drafts/hour.
 * - Offer stats return only aggregate counts (no user identities).
 *
 * AGENTS.md — REGULĂ MODERARE OBLIGATORIE.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertPartner({ supabase, userId }: Ctx) {
  const { data: isBiz, error } = await (supabase as any).rpc("has_role", {
    _user_id: userId,
    _role: "business",
  });
  if (error) throw new Error(error.message);
  if (!isBiz) throw new Error("forbidden: not a partner");
  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("partner_suspended_at, partner_suspension_reason")
    .eq("id", userId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (prof?.partner_suspended_at) {
    throw new Error(`suspended: ${prof.partner_suspension_reason ?? "see admin"}`);
  }
}

async function audit(
  userId: string,
  action: string,
  table: string,
  id: string,
  payload: Record<string, unknown>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    await (supabaseAdmin as any).from("admin_audit_log").insert({
      actor_id: userId,
      action,
      target_table: table,
      target_id: id,
      after_data: payload,
      severity: "info",
    });
  } catch {
    /* never block a mutation on audit failure */
  }
}

/* ---------------------------------- LIST ---------------------------------- */

export const partnerListMyItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPartner(context);
    const sb = context.supabase as any;
    const [v, e, o] = await Promise.all([
      sb
        .from("venues" as any)
        .select(
          "id,name,slug,category,city,cover_url,is_published,moderation_status,rejection_reason,created_at,updated_at",
        )
        .eq("owner_id", context.userId)
        .order("updated_at", { ascending: false }),
      sb
        .from("events" as any)
        .select(
          "id,title,city,venue,starts_at,ends_at,cover_url,is_published,moderation_status,rejection_reason,is_official,created_at",
        )
        .eq("host_id", context.userId)
        .order("starts_at", { ascending: false }),
      sb
        .from("offers" as any)
        .select(
          "id,venue_id,title,valid_from,valid_to,is_published,moderation_status,rejection_reason,created_at,venues!inner(owner_id,name)",
        )
        .eq("venues.owner_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);
    if (v.error) throw new Error(v.error.message);
    if (e.error) throw new Error(e.error.message);
    if (o.error) throw new Error(o.error.message);
    return { venues: v.data ?? [], events: e.data ?? [], offers: o.data ?? [] };
  });

export const partnerGetQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPartner(context);
    const { data, error } = await (context.supabase as any as any).rpc("partner_get_quota_usage", {
      p_user: context.userId,
    });
    if (error) throw new Error(error.message);
    return data as {
      venues: number;
      events: number;
      offers: number;
      drafts_last_hour: number;
      quotas: {
        max_venues: number;
        max_events: number;
        max_active_offers: number;
        max_drafts_per_hour: number;
      };
      suspended: boolean;
    };
  });

/* -------------------------------- QUOTA CHECK ----------------------------- */

async function checkQuota(ctx: Ctx, kind: "venue" | "event" | "offer") {
  const { data, error } = await (ctx.supabase as any).rpc("partner_get_quota_usage", {
    p_user: ctx.userId,
  });
  if (error) throw new Error(error.message);
  const q = data as any;
  if (q.drafts_last_hour >= q.quotas.max_drafts_per_hour)
    throw new Error("rate_limited: max drafts per hour reached");
  if (kind === "venue" && q.venues >= q.quotas.max_venues)
    throw new Error("quota_exceeded: max venues reached");
  if (kind === "event" && q.events >= q.quotas.max_events)
    throw new Error("quota_exceeded: max events reached");
  if (kind === "offer" && q.offers >= q.quotas.max_active_offers)
    throw new Error("quota_exceeded: max active offers reached");
}

/* --------------------------------- VENUES --------------------------------- */

const venueInput = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  cover_url: z.string().url().nullable().optional(),
  opening_hours: z.any().nullable().optional(),
  website: z.string().url().nullable().optional(),
  phone_e164: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/)
    .nullable()
    .optional(),
});

function bucketId(lat: number, lng: number) {
  return `${Math.floor(lat * 20)}:${Math.floor(lng * 20)}`;
}

export const partnerCreateVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => venueInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertPartner(context);
    await checkQuota(context, "venue");
    const { data: row, error } = await (context.supabase as any as any)
      .from("venues" as any)
      .insert({
        ...data,
        owner_id: context.userId,
        geo_bucket_id: bucketId(data.lat, data.lng),
        moderation_status: "pending",
        is_published: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.userId, "partner_create_venue", "venues", row.id, { name: data.name });
    return row;
  });

export const partnerUpdateVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: venueInput.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertPartner(context);
    const { data: cur, error: gErr } = await (context.supabase as any as any)
      .from("venues" as any)
      .select("id,owner_id,moderation_status")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!cur || cur.owner_id !== context.userId) throw new Error("not_found");
    const reMod = cur.moderation_status === "approved";
    const patch: any = { ...data.patch };
    if (data.patch.lat != null && data.patch.lng != null) {
      patch.geo_bucket_id = bucketId(data.patch.lat, data.patch.lng);
    }
    if (reMod) {
      patch.moderation_status = "pending";
      patch.is_published = false;
      patch.rejection_reason = null;
    }
    const { error } = await (context.supabase as any as any)
      .from("venues")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(
      context.userId,
      reMod ? "partner_edit_venue_remoderation" : "partner_edit_venue",
      "venues",
      data.id,
      {},
    );
    return { ok: true, re_moderation: reMod };
  });

/* --------------------------------- EVENTS --------------------------------- */

const eventInput = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).nullable().optional(),
  event_type: z.string().max(40).optional(),
  city: z.string().trim().max(120).nullable().optional(),
  venue: z.string().trim().max(200).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  starts_at: z.string(),
  ends_at: z.string().nullable().optional(),
  max_attendees: z.number().int().min(1).max(100000).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_private: z.boolean().optional(),
});

export const partnerCreateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => eventInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertPartner(context);
    await checkQuota(context, "event");
    const { data: row, error } = await (context.supabase as any as any)
      .from("events" as any)
      .insert({
        ...data,
        host_id: context.userId,
        geo_bucket_id: bucketId(data.lat, data.lng),
        moderation_status: "pending",
        is_published: false,
        is_official: false, // never owner-set
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.userId, "partner_create_event", "events", row.id, { title: data.title });
    return row;
  });

export const partnerUpdateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: eventInput.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertPartner(context);
    const { data: cur, error: gErr } = await (context.supabase as any as any)
      .from("events" as any)
      .select("id,host_id,moderation_status")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!cur || cur.host_id !== context.userId) throw new Error("not_found");
    const reMod = cur.moderation_status === "approved";
    const patch: any = { ...data.patch };
    if (data.patch.lat != null && data.patch.lng != null) {
      patch.geo_bucket_id = bucketId(data.patch.lat, data.patch.lng);
    }
    if (reMod) {
      patch.moderation_status = "pending";
      patch.is_published = false;
      patch.rejection_reason = null;
    }
    const { error } = await (context.supabase as any as any)
      .from("events")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(
      context.userId,
      reMod ? "partner_edit_event_remoderation" : "partner_edit_event",
      "events",
      data.id,
      {},
    );
    return { ok: true, re_moderation: reMod };
  });

/* --------------------------------- OFFERS --------------------------------- */

const offerInput = z.object({
  venue_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  terms: z.string().trim().max(2000).nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  max_claims_per_user: z.number().int().min(1).max(100).nullable().optional(),
});

async function assertVenueOwnership(ctx: Ctx, venueId: string) {
  const { data, error } = await ctx.supabase
    .from("venues" as any)
    .select("id,owner_id")
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.owner_id !== ctx.userId) throw new Error("forbidden: venue not yours");
}

export const partnerCreateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => offerInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertPartner(context);
    await assertVenueOwnership(context, data.venue_id);
    await checkQuota(context, "offer");
    const { data: row, error } = await (context.supabase as any as any)
      .from("offers" as any)
      .insert({ ...data, moderation_status: "pending", is_published: false })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.userId, "partner_create_offer", "offers", row.id, { title: data.title });
    return row;
  });

export const partnerUpdateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: offerInput.partial() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertPartner(context);
    const { data: cur, error: gErr } = await (context.supabase as any as any)
      .from("offers" as any)
      .select("id,venue_id,moderation_status,venues!inner(owner_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!cur || (cur as any).venues?.owner_id !== context.userId) throw new Error("not_found");
    if (data.patch.venue_id && data.patch.venue_id !== cur.venue_id) {
      await assertVenueOwnership(context, data.patch.venue_id);
    }
    const reMod = cur.moderation_status === "approved";
    const patch: any = { ...data.patch };
    if (reMod) {
      patch.moderation_status = "pending";
      patch.is_published = false;
      patch.rejection_reason = null;
    }
    const { error } = await (context.supabase as any as any)
      .from("offers")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(
      context.userId,
      reMod ? "partner_edit_offer_remoderation" : "partner_edit_offer",
      "offers",
      data.id,
      {},
    );
    return { ok: true, re_moderation: reMod };
  });

export const partnerGetOfferStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offer_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertPartner(context);
    // Verify ownership before exposing stats.
    const { data: row, error } = await (context.supabase as any as any)
      .from("offers" as any)
      .select("id,venue_id,venues!inner(owner_id)")
      .eq("id", data.offer_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || (row as any).venues?.owner_id !== context.userId) throw new Error("not_found");
    const { data: stats, error: sErr } = await (context.supabase as any as any)
      .rpc("offer_stats", { p_offer_id: data.offer_id })
      .single();
    if (sErr) throw new Error(sErr.message);
    return stats; // aggregate only — no user identities
  });

/* --------------------- STATUS NOTIFICATIONS (partner) --------------------- */

export const partnerListStatusNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPartner(context);
    const { data, error } = await (context.supabase as any)
      .from("partner_status_notifications")
      .select("id,kind,item_id,item_title,decision,reason,created_at,read_at")
      .eq("partner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      kind: "venue" | "event" | "offer";
      item_id: string;
      item_title: string | null;
      decision: "approved" | "rejected" | "changes_requested";
      reason: string | null;
      created_at: string;
      read_at: string | null;
    }>;
  });

export const partnerMarkNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertPartner(context);
    const sb = (context.supabase as any).from("partner_status_notifications");
    const q = sb
      .update({ read_at: new Date().toISOString() })
      .eq("partner_id", context.userId)
      .is("read_at", null);
    const { error } = data.ids?.length ? await q.in("id", data.ids) : await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
