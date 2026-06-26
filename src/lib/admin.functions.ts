import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tables that are safe to expose in the Data Explorer.
// PostGIS system tables are excluded.
const ALLOWED_TABLES = [
  "ad_campaigns",
  "ad_events",
  "advertisers",
  "album_requests",
  "album_unlocks",
  "banned_fingerprints",
  "blocks",
  "business_applications",
  "conversations",
  "daily_rewards",
  "device_fingerprints",
  "event_rsvps",
  "events",
  "favorites",
  "group_members",
  "group_messages",
  "groups",
  "matches",
  "messages",
  "notifications",
  "photo_hashes",
  "private_albums",
  "profile_live_events",
  "profile_views",
  "profiles",
  "push_subscriptions",
  "quest_templates",
  "reports",
  "risk_flags",
  "sos_events",
  "stories",
  "story_views",
  "subscriptions",
  "swipes",
  "taps",
  "user_quests",
  "user_roles",
  "woofs",
  "xp_events",
] as const;

export type AdminTable = (typeof ALLOWED_TABLES)[number];

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

/** Aggregate counts for the overview dashboard. */
export const adminGetOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;

    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const head = (table: string, filter?: (q: any) => any) => {
      let q: any = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      return q;
    };

    const [
      profilesAll,
      profiles24h,
      profiles7d,
      messages24h,
      reportsPending,
      adsActive,
      adsPending,
      bizPending,
      eventsAll,
      events24h,
      matches24h,
      sosEvents,
      banned,
      suspended,
      verified,
      subsActive,
    ] = await Promise.all([
      head("profiles"),
      head("profiles", (q) => q.gte("created_at", since24h)),
      head("profiles", (q) => q.gte("created_at", since7d)),
      head("messages", (q) => q.gte("created_at", since24h)),
      head("reports", (q) => q.eq("status", "pending")),
      head("ad_campaigns", (q) => q.eq("status", "active")),
      head("ad_campaigns", (q) => q.eq("status", "pending")),
      head("business_applications", (q) => q.in("status", ["pending", "reviewing"])),
      head("events"),
      head("events", (q) => q.gte("created_at", since24h)),
      head("matches", (q) => q.gte("created_at", since24h)),
      head("sos_events", (q) => q.gte("triggered_at", since7d)),
      head("profiles", (q) => q.not("banned_at", "is", null)),
      head("profiles", (q) => q.gt("suspended_until", new Date().toISOString())),
      head("profiles", (q) => q.eq("verified", true)),
      head("subscriptions", (q) => q.eq("status", "active")),
    ]);

    return {
      profiles: {
        total: profilesAll.count ?? 0,
        last24h: profiles24h.count ?? 0,
        last7d: profiles7d.count ?? 0,
        verified: verified.count ?? 0,
        banned: banned.count ?? 0,
        suspended: suspended.count ?? 0,
      },
      activity: {
        messages24h: messages24h.count ?? 0,
        matches24h: matches24h.count ?? 0,
        events: eventsAll.count ?? 0,
        events24h: events24h.count ?? 0,
        sos7d: sosEvents.count ?? 0,
      },
      moderation: {
        reportsPending: reportsPending.count ?? 0,
        adsActive: adsActive.count ?? 0,
        adsPending: adsPending.count ?? 0,
        bizPending: bizPending.count ?? 0,
        subsActive: subsActive.count ?? 0,
      },
    };
  });

/** List all allowed tables with their row counts. */
export const adminListTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const results = await Promise.all(
      ALLOWED_TABLES.map(async (t) => {
        const { count } = await supabaseAdmin.from(t).select("*", { count: "exact", head: true });
        return { name: t, count: count ?? 0 };
      }),
    );
    return results;
  });

const ListInput = z.object({
  table: z.enum(ALLOWED_TABLES as unknown as [string, ...string[]]),
  search: z.string().max(200).optional(),
  searchColumn: z.string().max(80).optional(),
  orderBy: z.string().max(80).optional(),
  orderDir: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

/**
 * Coloane MASCATE by default în panoul admin. Datele Art. 9 / locație precisă /
 * mesaje brute / selfie verificare NU sunt proiectate prin listingul generic
 * — vezi `adminBreakGlassReveal` și AGENTS.md → "REGULĂ — ADMIN".
 */
const SENSITIVE_COLUMNS: Record<string, string[]> = {
  profiles: [
    // Sănătate (Art. 9) — DOAR super_admin via break-glass kind='health'
    "hiv_status_enc", "hiv_test_date_enc", "health_data_consent_at",
    // Orientare / identitate sexuală (Art. 9 — viața sexuală) — break-glass
    // kind='orientation'. Pe o app queer `gender` + `tribes` + `pronouns` pot
    // dezvălui orientarea indirect, deci sunt tratate la fel.
    "orientation", "gender", "gender_custom", "pronouns", "pronouns_custom", "tribes",
    // Locație precisă — break-glass kind='location' (super_admin)
    "location", "prev_location", "travel_location",
    // Contact / credențiale
    "phone_e164", "email_hash", "pin_hash", "pin_lock_until",
  ],
  messages: ["body", "media_url", "voice_url", "caption"],
  group_messages: ["body", "media_url"],
  // CSAM never-render: photo_url NU se proiectează niciodată în UI admin.
  csam_reports: ["photo_url"],
  age_verifications: ["selfie_url", "document_url", "raw_payload"],
  push_subscriptions: ["endpoint", "auth", "p256dh"],
  device_fingerprints: ["fingerprint", "user_agent", "ip"],
  // Anonimitatea raportorului DSA — illegal_content_reports este anonim by design.
  illegal_content_reports: ["reporter_email", "reporter_user_id"],
};

function safeColumnsFor(table: string): string {
  if (table === "messages" || table === "group_messages") {
    return "id, conversation_id, sender_id, created_at, deleted_at";
  }
  if (table === "csam_reports") {
    // Niciodată photo_url. Doar referință/hash + status.
    return "id, user_id, hash, match_source, ncmec_report_id, reported_at, status, notes";
  }
  if (table === "age_verifications") {
    return "id, user_id, status, created_at, completed_at";
  }
  if (table === "illegal_content_reports") {
    return "id, category, content_type, content_url, description, legal_basis, status, handled_by, handled_at, resolution, created_at";
  }
  if (table === "profiles") {
    return [
      "id","display_name","travel_city","verified","banned_at","suspended_until",
      "report_count","level","xp","created_at","updated_at","last_active_at",
      "is_premium","age",
    ].join(",");
  }
  return "*";
}

/** Generic list rows. Sensitive columns are stripped by default. */
export const adminListRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;
    const projection = safeColumnsFor(data.table);
    if (data.search && data.searchColumn) {
      const denied = SENSITIVE_COLUMNS[data.table] ?? [];
      if (denied.includes(data.searchColumn)) throw new Error("forbidden_column");
    }
    let q: any = supabaseAdmin.from(data.table).select(projection, { count: "exact" });
    if (data.search && data.searchColumn) q = q.ilike(data.searchColumn, `%${data.search}%`);
    const orderBy = data.orderBy ?? "created_at";
    const orderDir = data.orderDir ?? "desc";
    q = q.order(orderBy, { ascending: orderDir === "asc", nullsFirst: false });
    q = q.range(offset, offset + limit - 1);
    const { data: rows, count, error } = await q;
    if (error) {
      let q2: any = supabaseAdmin.from(data.table).select(projection, { count: "exact" }).range(offset, offset + limit - 1);
      if (data.search && data.searchColumn) q2 = q2.ilike(data.searchColumn, `%${data.search}%`);
      const r2 = await q2;
      if (r2.error) throw new Error(r2.error.message);
      return { rows: r2.data ?? [], count: r2.count ?? 0, masked: true };
    }
    return { rows: rows ?? [], count: count ?? 0, masked: true };
  });

const UpdateInput = z.object({
  table: z.enum(ALLOWED_TABLES as unknown as [string, ...string[]]),
  id: z.union([z.string(), z.number()]),
  idColumn: z.string().max(80).optional(),
  patch: z.record(z.unknown()),
});

/** Update a single row by id. */
export const adminUpdateRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const idCol = data.idColumn ?? "id";
    const { error } = await supabaseAdmin.from(data.table).update(data.patch).eq(idCol, data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteInput = z.object({
  table: z.enum(ALLOWED_TABLES as unknown as [string, ...string[]]),
  id: z.union([z.string(), z.number()]),
  idColumn: z.string().max(80).optional(),
});

/** Delete a single row by id. */
export const adminDeleteRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const idCol = data.idColumn ?? "id";
    const { error } = await supabaseAdmin.from(data.table).delete().eq(idCol, data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const InsertInput = z.object({
  table: z.enum(ALLOWED_TABLES as unknown as [string, ...string[]]),
  values: z.record(z.unknown()),
});

/** Insert a single row. */
export const adminInsertRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { data: row, error } = await supabaseAdmin.from(data.table).insert(data.values).select().single();
    if (error) throw new Error(error.message);
    return { row };
  });

const SearchUsersInput = z.object({ q: z.string().max(200).optional(), limit: z.number().int().min(1).max(100).optional() });

/** Search users (profiles + auth email via admin). */
export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchUsersInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const limit = data.limit ?? 50;
    let q: any = supabaseAdmin
      .from("profiles")
      .select("id, display_name, travel_city, verified, banned_at, suspended_until, report_count, level, xp, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data.q) {
      q = q.or(`display_name.ilike.%${data.q}%,travel_city.ilike.%${data.q}%,id.eq.${isUuid(data.q) ? data.q : "00000000-0000-0000-0000-000000000000"}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Roles
    const ids = (rows ?? []).map((r: any) => r.id);
    let rolesByUser: Record<string, string[]> = {};
    if (ids.length) {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);
      (roles ?? []).forEach((r: any) => {
        rolesByUser[r.user_id] = rolesByUser[r.user_id] ?? [];
        rolesByUser[r.user_id].push(r.role);
      });
    }
    return (rows ?? []).map((r: any) => ({ ...r, roles: rolesByUser[r.id] ?? [] }));
  });

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

const RoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "moderator", "user", "business"]),
});

/** Grant a role to a user. */
export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Revoke a role from a user. */
export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BroadcastInput = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  link: z.string().max(500).optional(),
  audience: z.enum(["all", "verified", "business"]).optional(),
});

/** Send a broadcast notification to many users. */
export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BroadcastInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;

    let q: any = supabaseAdmin.from("profiles").select("id");
    if (data.audience === "verified") q = q.eq("verified", true);
    const { data: profs, error: pErr } = await q.limit(5000);
    if (pErr) throw new Error(pErr.message);

    let userIds: string[] = (profs ?? []).map((p: any) => p.id);
    if (data.audience === "business") {
      const { data: bizRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "business");
      const set = new Set((bizRoles ?? []).map((r: any) => r.user_id));
      userIds = userIds.filter((id) => set.has(id));
    }

    if (!userIds.length) return { delivered: 0 };

    const rows = userIds.map((uid) => ({
      user_id: uid,
      type: "message",
      title: data.title,
      body: data.body,
      link: data.link ?? null,
      actor_id: context.userId,
    }));

    // Insert in chunks of 500
    let delivered = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("notifications").insert(chunk);
      if (!error) delivered += chunk.length;
    }
    return { delivered };
  });

/** Force-delete a user account (auth + cascade). */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Nu te poți șterge pe tine.");
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ADMIN_TABLES = ALLOWED_TABLES;
