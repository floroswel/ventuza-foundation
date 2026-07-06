// CEO-level intelligence: MRR, Retention, Funnel, Kill switches, Force-update
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(sb: any, userId: string) {
  const { data } = await sb.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}
async function assertAdmin(sb: any, userId: string) {
  const { data } = await sb.rpc("is_admin_or_above", { _user_id: userId });
  if (!data) throw new Error("Forbidden: admin required");
}

export const getRevenueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("admin_revenue_stats");
    if (error) throw new Error(error.message);
    return data;
  });

export const getRetentionCohorts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(7).max(90).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.rpc("admin_retention_cohorts", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getFunnelStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: v, error } = await context.supabase.rpc("admin_funnel_stats", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return v;
  });

/* ---------------- KILL SWITCHES ---------------- */
const KILL_KEYS = ["chat", "matching", "uploads", "discover", "signup", "partner_portal"] as const;
type KillKey = (typeof KILL_KEYS)[number];

export const getKillSwitches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "kill_switches")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const v = (data?.value ?? {}) as Record<string, boolean>;
    const out: Record<KillKey, boolean> = {} as any;
    for (const k of KILL_KEYS) out[k] = !!v[k];
    return out;
  });

export const setKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.enum(KILL_KEYS),
        on: z.boolean(),
        reason: z.string().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: cur } = await sa
      .from("app_settings")
      .select("value")
      .eq("key", "kill_switches")
      .maybeSingle();
    const next = { ...(cur?.value ?? {}), [data.key]: data.on };
    const { error } = await sa.rpc("admin_update_setting", {
      _key: "kill_switches",
      _value: next,
      _reason: data.reason,
    });
    if (error) {
      // fallback: direct update + audit
      await sa.from("app_settings").update({ value: next }).eq("key", "kill_switches");
      await sa.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: `killswitch_${data.on ? "on" : "off"}`,
        target_table: "app_settings",
        target_id: "kill_switches",
        justification: data.reason,
        after_data: next,
        severity: data.on ? "critical" : "warning",
      });
    }
    return { ok: true, killSwitches: next };
  });

/* ---------------- MIN SUPPORTED VERSION ---------------- */
export const getMinVersion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "min_supported_version")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data?.value ?? { web: "0.0.0", ios: "0.0.0", android: "0.0.0", force_update_message: "" }
    );
  });

export const setMinVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        web: z.string().regex(/^\d+\.\d+\.\d+$/),
        ios: z.string().regex(/^\d+\.\d+\.\d+$/),
        android: z.string().regex(/^\d+\.\d+\.\d+$/),
        force_update_message: z.string().max(280),
        reason: z.string().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const value = {
      web: data.web,
      ios: data.ios,
      android: data.android,
      force_update_message: data.force_update_message,
    };
    await sa.from("app_settings").update({ value }).eq("key", "min_supported_version");
    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "min_version_set",
      target_table: "app_settings",
      target_id: "min_supported_version",
      justification: data.reason,
      after_data: value,
      severity: "warning",
    });
    return { ok: true, value };
  });

/* ---------------- A/B EXPERIMENT RESULTS (z-test p-value) ---------------- */
/**
 * Agregă `experiment_events` per variant pentru un experiment dat și
 * întoarce numărul de expuneri, conversii, rata de conversie și, pentru
 * variantele treatment vs. control, un z-test cu p-value bilateral. Nu
 * facem sequential monitoring aici; consumatorul trebuie să respecte MDE
 * și să nu opreascp devreme (peek). Vezi TODO — A/B testing cu p-value.
 */
export const getExperimentResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.string().min(1).max(120),
        days: z.number().int().min(1).max(365).default(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("experiment_events")
      .select("variant,event,user_id")
      .eq("experiment_key", data.key)
      .gte("created_at", since)
      .limit(200_000);
    if (error) throw new Error(error.message);

    // Unique users per variant per event type (fallback la rânduri dacă
    // user_id lipsește — evenimente anonime numărate ca observații).
    const exposures = new Map<string, Set<string>>();
    const conversions = new Map<string, Set<string>>();
    let expAny = 0;
    let convAny = 0;
    for (const r of rows ?? []) {
      const v = String(r.variant ?? "");
      const key = String(r.user_id ?? `anon:${Math.random()}`);
      if (r.event === "exposure" || r.event === "assigned") {
        if (!exposures.has(v)) exposures.set(v, new Set());
        exposures.get(v)!.add(key);
        expAny++;
      } else if (r.event === "conversion" || r.event === "converted") {
        if (!conversions.has(v)) conversions.set(v, new Set());
        conversions.get(v)!.add(key);
        convAny++;
      }
    }

    const variants = Array.from(new Set([...exposures.keys(), ...conversions.keys()])).sort();
    // Fallback dacă nu s-au emis explicit "exposure": tratăm any-event drept
    // expunere, altfel panoul rămâne mereu gol.
    const useExposureFallback = expAny === 0 && convAny === 0;
    if (useExposureFallback) {
      for (const r of rows ?? []) {
        const v = String(r.variant ?? "");
        const key = String(r.user_id ?? `anon:${Math.random()}`);
        if (!exposures.has(v)) exposures.set(v, new Set());
        exposures.get(v)!.add(key);
      }
    }

    const perVariant = variants.map((v) => {
      const n = exposures.get(v)?.size ?? 0;
      const c = conversions.get(v)?.size ?? 0;
      return { variant: v, exposures: n, conversions: c, rate: n > 0 ? c / n : 0 };
    });

    // Two-proportion z-test față de prima variantă (convențional "control").
    // p-value bilateral folosind aproximarea Abramowitz & Stegun 7.1.26 pentru erfc.
    const control = perVariant[0];
    function pValue(cA: number, nA: number, cB: number, nB: number): number | null {
      if (!cA || !nA || !cB || !nB) return null;
      const pA = cA / nA;
      const pB = cB / nB;
      const p = (cA + cB) / (nA + nB);
      const se = Math.sqrt(p * (1 - p) * (1 / nA + 1 / nB));
      if (se === 0) return null;
      const z = (pB - pA) / se;
      // erfc via Abramowitz & Stegun; p = erfc(|z| / sqrt(2))
      const x = Math.abs(z) / Math.SQRT2;
      const t = 1 / (1 + 0.3275911 * x);
      const y =
        t *
        (0.254829592 +
          t *
            (-0.284496736 +
              t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
      const erfc = y * Math.exp(-x * x);
      return Math.max(0, Math.min(1, erfc));
    }

    const comparisons = perVariant.slice(1).map((v) => ({
      vs: control?.variant ?? "",
      variant: v.variant,
      lift:
        control && control.rate > 0 ? (v.rate - control.rate) / control.rate : null,
      p_value: control ? pValue(control.conversions, control.exposures, v.conversions, v.exposures) : null,
    }));

    return {
      key: data.key,
      days: data.days,
      per_variant: perVariant,
      comparisons,
      total_events: rows?.length ?? 0,
      exposure_fallback: useExposureFallback,
    };
  });

/* ---------------- PUSH DELIVERY HEALTH (FCM/APNS/Web) ---------------- */
export const getPushHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: subs, error } = await context.supabase
      .from("push_subscriptions")
      .select("platform,kind,last_seen_at,created_at")
      .limit(50_000);
    if (error) throw new Error(error.message);

    const now = Date.now();
    const active7 = new Date(now - 7 * 86_400_000).toISOString();
    const active30 = new Date(now - 30 * 86_400_000).toISOString();

    const byPlatform = new Map<
      string,
      { total: number; active7: number; active30: number; kinds: Record<string, number> }
    >();
    for (const s of subs ?? []) {
      const p = String(s.platform ?? "unknown");
      if (!byPlatform.has(p))
        byPlatform.set(p, { total: 0, active7: 0, active30: 0, kinds: {} });
      const b = byPlatform.get(p)!;
      b.total++;
      if (s.last_seen_at && s.last_seen_at >= active7) b.active7++;
      if (s.last_seen_at && s.last_seen_at >= active30) b.active30++;
      const k = String(s.kind ?? "web");
      b.kinds[k] = (b.kinds[k] ?? 0) + 1;
    }

    // Notificări trimise vs. citite ultimele 7 zile
    const { data: notif, error: nErr } = await context.supabase
      .from("notifications")
      .select("type,read_at,created_at")
      .gte("created_at", active7)
      .limit(50_000);
    if (nErr) throw new Error(nErr.message);
    const notifStats = new Map<string, { sent: number; read: number }>();
    for (const n of notif ?? []) {
      const k = String(n.type ?? "other");
      if (!notifStats.has(k)) notifStats.set(k, { sent: 0, read: 0 });
      const b = notifStats.get(k)!;
      b.sent++;
      if (n.read_at) b.read++;
    }

    return {
      platforms: Array.from(byPlatform.entries()).map(([platform, v]) => ({ platform, ...v })),
      totals: {
        subscriptions: subs?.length ?? 0,
        active_7d: (subs ?? []).filter((s) => s.last_seen_at && s.last_seen_at >= active7).length,
        active_30d: (subs ?? []).filter((s) => s.last_seen_at && s.last_seen_at >= active30).length,
      },
      notifications_7d: Array.from(notifStats.entries()).map(([kind, v]) => ({
        kind,
        sent: v.sent,
        read: v.read,
        read_rate: v.sent > 0 ? v.read / v.sent : 0,
      })),
    };
  });

/* ---------------- PARTNER BOOST CALENDAR ---------------- */
export const getPartnerBoostCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        days_ahead: z.number().int().min(1).max(90).default(30),
        days_back: z.number().int().min(0).max(30).default(3),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const from = new Date(Date.now() - data.days_back * 86_400_000).toISOString();
    const to = new Date(Date.now() + data.days_ahead * 86_400_000).toISOString();

    const { data: orders, error } = await context.supabase
      .from("partner_boost_orders")
      .select("id,event_id,owner_id,starts_at,ends_at,active,is_seed")
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at", { ascending: true })
      .limit(1_000);
    if (error) throw new Error(error.message);

    const eventIds = Array.from(new Set((orders ?? []).map((o) => o.event_id).filter(Boolean)));
    let eventsMap = new Map<string, { title: string; city: string | null; starts_at: string | null }>();
    if (eventIds.length) {
      const { data: evs } = await context.supabase
        .from("events")
        .select("id,title,city,starts_at")
        .in("id", eventIds);
      for (const e of evs ?? [])
        eventsMap.set(String(e.id), {
          title: String(e.title ?? "—"),
          city: (e.city ?? null) as string | null,
          starts_at: (e.starts_at ?? null) as string | null,
        });
    }

    // Grupare pe zi (calendar) + pe oraș (conflict detection).
    const byDay = new Map<string, number>();
    const byCity = new Map<string, number>();
    const rows = (orders ?? []).map((o) => {
      const ev = eventsMap.get(String(o.event_id));
      const day = (o.starts_at ?? "").slice(0, 10);
      if (day) byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const city = ev?.city ?? "necunoscut";
      byCity.set(city, (byCity.get(city) ?? 0) + 1);
      return {
        id: o.id,
        event_id: o.event_id,
        event_title: ev?.title ?? "—",
        city,
        starts_at: o.starts_at,
        ends_at: o.ends_at,
        active: o.active,
        is_seed: o.is_seed,
      };
    });
    return {
      orders: rows,
      by_day: Array.from(byDay.entries())
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      by_city: Array.from(byCity.entries())
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count),
    };
  });

/* ---------------- ANTI-FRAUD DEVICE / IP CLUSTERS ---------------- */
/**
 * Grupează device fingerprints care apar pe >1 user (indicator multi-account).
 * Nu returnează fingerprint-ul brut (`SENSITIVE_COLUMNS.device_fingerprints`);
 * doar un hash short pentru identificare vizuală + numărul de useri afectați.
 */
export const getFraudClusters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        min_users: z.number().int().min(2).max(50).default(2),
        days: z.number().int().min(1).max(180).default(60),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("device_fingerprints")
      .select("fingerprint,user_id,last_seen_at")
      .gte("last_seen_at", since)
      .limit(50_000);
    if (error) throw new Error(error.message);

    const groups = new Map<string, { users: Set<string>; last_seen: string }>();
    for (const r of rows ?? []) {
      const fp = String(r.fingerprint ?? "");
      if (!fp) continue;
      if (!groups.has(fp)) groups.set(fp, { users: new Set(), last_seen: "" });
      const g = groups.get(fp)!;
      g.users.add(String(r.user_id));
      if (!g.last_seen || (r.last_seen_at ?? "") > g.last_seen)
        g.last_seen = r.last_seen_at ?? g.last_seen;
    }
    const clusters = Array.from(groups.entries())
      .filter(([, g]) => g.users.size >= data.min_users)
      .map(([fp, g]) => ({
        // Mask fingerprint: primele 8 caractere din hash, suficient ca ID vizual
        fp_hash: fp.slice(0, 8),
        users_count: g.users.size,
        user_ids: Array.from(g.users).slice(0, 20),
        last_seen: g.last_seen,
      }))
      .sort((a, b) => b.users_count - a.users_count)
      .slice(0, 200);

    // GDPR Art.6(1)(f) — legitimate interest: log cluster inspection (metadata, masked hashes only)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("admin_audit_log").insert({
        actor_id: context.userId,
        action: "fraud.cluster_view",
        target_table: "device_fingerprints",
        severity: "info",
        after_data: {
          min_users: data.min_users,
          days: data.days,
          cluster_count: clusters.length,
          top_clusters: clusters.slice(0, 10).map((c) => ({
            fp_hash: c.fp_hash,
            users_count: c.users_count,
          })),
        },
      });
    } catch {}

    return {
      clusters,
      total_fingerprints: rows?.length ?? 0,
      cluster_count: clusters.length,
    };
  });
