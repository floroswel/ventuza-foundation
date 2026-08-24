/**
 * Sesiuni & dispozitive per user — GDPR-safe.
 *
 * AGENTS.md — REGULĂ ADMIN:
 *  - rol verificat server-side (`is_admin_or_above`) ÎNAINTE de orice acces
 *    la `supabaseAdmin`;
 *  - `assertAdminMfa` pe revocare (acțiune distructivă);
 *  - date sensibile MASCATE: nu returnăm niciodată fingerprint-ul brut,
 *    user-agent-ul complet, endpoint-ul push sau cheile push. Doar prefix
 *    hash-uit, platformă derivată și timestamps;
 *  - fiecare acțiune scrie în `admin_audit_log`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin_or_above", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

function reqMeta() {
  try {
    return {
      ip: (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() || null,
      ua: getRequestHeader("user-agent") ?? null,
    };
  } catch {
    return { ip: null, ua: null };
  }
}

async function logAudit(opts: {
  actorId: string;
  action: string;
  targetId?: string | null;
  after?: unknown;
  justification?: string | null;
  severity?: "info" | "warning" | "critical";
}) {
  const meta = reqMeta();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    actor_id: opts.actorId,
    action: opts.action,
    target_table: "auth.sessions",
    target_id: opts.targetId ?? null,
    after_data: opts.after ?? null,
    justification: opts.justification ?? null,
    severity: opts.severity ?? "warning",
    ip: meta.ip,
    user_agent: meta.ua,
  });
}

/** Hash scurt, ireversibil în practică pentru afișare (nu expunem valoarea brută). */
async function shortHash(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Derivă doar platforma/browserul dintr-un user agent — fără string brut. */
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
  const app = /Suzeta|wv\)|Capacitor/i.test(ua) ? "aplicație" : "browser";
  return `${os} · ${app}`;
}

export type AdminUserDevice = {
  id: string;
  kind: "device" | "push";
  label: string;
  ref: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

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
        .select("id, endpoint, created_at, updated_at, platform")
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
      });
    }
    return { devices };
  });

/**
 * Revocă TOATE sesiunile active ale userului (deconectare globală) și, opțional,
 * abonamentele push. Nu returnează niciodată token-uri sau identificatori bruți.
 */
export const adminRevokeUserSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        justification: z.string().min(10).max(500),
        revokePush: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    // GoTrue admin: invalidează refresh tokens + sesiuni pentru user.
    const url = `${process.env["SUPABASE_URL"]}/auth/v1/admin/users/${data.userId}/sessions`;
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const sessionsRevoked = res.ok;

    let pushRemoved = 0;
    if (data.revokePush) {
      const { data: rows, error } = await sa
        .from("push_subscriptions")
        .delete()
        .eq("user_id", data.userId)
        .select("id");
      if (error) throw new Error(error.message);
      pushRemoved = (rows ?? []).length;
    }

    await logAudit({
      actorId: context.userId,
      action: "revoke_user_sessions",
      targetId: data.userId,
      after: { sessionsRevoked, pushRemoved, status: res.status },
      justification: data.justification,
      severity: "critical",
    });

    if (!sessionsRevoked) {
      throw new Error(`Revocarea sesiunilor a eșuat (status ${res.status})`);
    }
    return { sessionsRevoked, pushRemoved };
  });
