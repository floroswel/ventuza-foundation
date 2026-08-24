// User Session / Device management — list + force-signout, audited.
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminMfa } from "@/lib/admin-mfa-guard";

async function assertAdmin(sb: any, userId: string) {
  const { data, error } = await sb.rpc("is_admin_or_above", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function logAudit(
  actorId: string,
  action: string,
  targetId: string,
  extra?: any,
  severity: "info" | "warning" | "critical" = "warning",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let ip: string | null = null,
    ua: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {}
  try {
    ua = getRequestHeader("user-agent") ?? null;
  } catch {}
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_table: "auth.users",
    target_id: targetId,
    after_data: extra ?? null,
    severity,
    ip,
    user_agent: ua,
  });
}

/* List user auth metadata + registered devices */
export const adminGetUserAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: u, error } = await sa.auth.admin.getUserById(data.userId);
    if (error) throw new Error(error.message);
    const [{ data: pushSubs }, { data: fps }] = await Promise.all([
      sa
        .from("push_subscriptions")
        .select("id, platform, created_at, last_seen_at, disabled_at")
        .eq("user_id", data.userId)
        .order("last_seen_at", { ascending: false }),
      sa
        .from("device_fingerprints")
        .select("id, first_seen_at, last_seen_at, seen_count")
        .eq("user_id", data.userId)
        .order("last_seen_at", { ascending: false })
        .limit(20),
    ]);
    return {
      user: {
        id: u.user?.id,
        email: u.user?.email,
        phone: u.user?.phone,
        created_at: u.user?.created_at,
        last_sign_in_at: u.user?.last_sign_in_at,
        email_confirmed_at: u.user?.email_confirmed_at,
        banned_until: (u.user as any)?.banned_until,
        identities: (u.user?.identities ?? []).map((i: any) => ({
          provider: i.provider,
          created_at: i.created_at,
          last_sign_in_at: i.last_sign_in_at,
        })),
      },
      pushSubscriptions: pushSubs ?? [],
      deviceFingerprints: fps ?? [],
    };
  });

/* Force sign-out all sessions for the user.
   Supabase doesn't expose a direct "revoke all sessions by user_id" JS admin API,
   so we use the documented pattern: `ban_duration: '1s'` invalidates refresh
   tokens, then we clear the ban immediately. */
export const adminRevokeUserSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        reason: z.string().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    // Invalidate refresh tokens via short ban
    const { error: banErr } = await sa.auth.admin.updateUserById(data.userId, {
      ban_duration: "1s",
    });
    if (banErr) throw new Error("Nu am putut invalida sesiunile: " + banErr.message);
    // Immediately clear the ban (session invalidation already applied)
    await sa.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    // Disable all push subscriptions
    await sa
      .from("push_subscriptions")
      .update({ disabled_at: new Date().toISOString() })
      .eq("user_id", data.userId)
      .is("disabled_at", null);
    await logAudit(
      context.userId,
      "session_revoke_all",
      data.userId,
      { reason: data.reason },
      "warning",
    );
    return { ok: true };
  });

/* Revoke a single push subscription (device) */
export const adminRevokePushSub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        subscriptionId: z.string().uuid(),
        reason: z.string().min(3).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    await sa
      .from("push_subscriptions")
      .update({ disabled_at: new Date().toISOString() })
      .eq("id", data.subscriptionId)
      .eq("user_id", data.userId);
    await logAudit(
      context.userId,
      "push_sub_revoke",
      data.userId,
      { subscription_id: data.subscriptionId, reason: data.reason },
      "info",
    );
    return { ok: true };
  });

/* ------------------------------------------------------------------ *
 * Dispozitive per user — GDPR-safe (date minimizate).
 * Nu returnăm fingerprint brut, user agent complet sau endpoint push:
 * doar platformă derivată, referință hash-uită și timestamps.
 * ------------------------------------------------------------------ */

export type AdminUserDevice = {
  id: string;
  kind: "device" | "push";
  label: string;
  ref: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  disabledAt: string | null;
};

async function shortHash(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function coarseDevice(ua: string | null): string {
  if (!ua) return "necunoscut";
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "necunoscut";
  const app = /Capacitor|Suzeta|; wv\)/i.test(ua) ? "aplicație" : "browser";
  return `${os} · ${app}`;
}

export const adminListUserDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    const [fps, pushes] = await Promise.all([
      sa
        .from("device_fingerprints")
        .select("id, fingerprint, user_agent, first_seen_at, last_seen_at")
        .eq("user_id", data.userId)
        .order("last_seen_at", { ascending: false })
        .limit(50),
      sa
        .from("push_subscriptions")
        .select("id, endpoint, created_at, updated_at, platform, disabled_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (fps.error) throw new Error(fps.error.message);
    if (pushes.error) throw new Error(pushes.error.message);

    const devices: AdminUserDevice[] = [];
    for (const r of fps.data ?? []) {
      devices.push({
        id: r.id,
        kind: "device",
        label: coarseDevice(r.user_agent ?? null),
        ref: `fp:${await shortHash(String(r.fingerprint ?? r.id))}`,
        firstSeenAt: r.first_seen_at ?? null,
        lastSeenAt: r.last_seen_at ?? null,
        disabledAt: null,
      });
    }
    for (const r of pushes.data ?? []) {
      devices.push({
        id: r.id,
        kind: "push",
        label: `push · ${r.platform ?? "web"}`,
        ref: `push:${await shortHash(String(r.endpoint ?? r.id))}`,
        firstSeenAt: r.created_at ?? null,
        lastSeenAt: r.updated_at ?? r.created_at ?? null,
        disabledAt: r.disabled_at ?? null,
      });
    }
    return { devices };
  });
