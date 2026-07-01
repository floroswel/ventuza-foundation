import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * BREAK-GLASS — acces controlat la date sensibile din panoul admin.
 *
 * Reguli (vezi AGENTS.md → "REGULĂ — ADMIN"):
 *  - `orientation` → DOAR super_admin
 *  - `location`    → DOAR super_admin (returnează coordonate proprii)
 *  - `selfie`      → admin sau super_admin
 *  - `messages`    → admin sau super_admin
 *
 * Notă: kind='health' a fost eliminat — Ventuza nu mai procesează date HIV.
 */

async function reqMeta() {
  let ip: string | null = null;
  let ua: string | null = null;
  try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch {}
  try { ua = getRequestHeader("user-agent") ?? null; } catch {}
  return { ip, ua };
}

const RevealInput = z.object({
  targetUserId: z.string().uuid(),
  kind: z.enum(["orientation", "location", "selfie", "messages"]),
  justification: z.string().min(10).max(500),
  conversationId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const adminBreakGlassReveal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RevealInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    // 0) MFA obligatorie — break-glass este cea mai sensibilă acțiune admin.
    const { assertAdminMfa } = await import("./admin-mfa-guard");
    await assertAdminMfa(context.userId);

    // 1) Verifică server-side dacă rolul este suficient pentru `kind`.
    const { data: allowed, error: roleErr } = await sa.rpc("admin_can_access_sensitive", {
      _user_id: context.userId, _kind: data.kind,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!allowed) throw new Error("Forbidden: rol insuficient pentru această categorie sensibilă.");

    // 2) Pregătim payload-ul cerut.
    let payload: any = {};
    let fields: string[] = [];

    if (data.kind === "orientation") {
      const { data: p } = await sa.from("profiles")
        .select("id, orientation, gender, gender_custom, pronouns, pronouns_custom, tribes")
        .eq("id", data.targetUserId).maybeSingle();
      payload = { profile: p ?? null };
      fields = ["orientation", "gender", "gender_custom", "pronouns", "pronouns_custom", "tribes"];
    } else if (data.kind === "location") {
      const { data: p } = await sa.from("profiles")
        .select("id, travel_city, last_active_at, location")
        .eq("id", data.targetUserId).maybeSingle();
      payload = { profile: p ?? null };
      fields = ["location", "travel_city"];
    } else if (data.kind === "selfie") {
      const { data: v } = await sa.from("age_verifications")
        .select("id,user_id,status,selfie_url,document_url,created_at,completed_at")
        .eq("user_id", data.targetUserId).order("created_at", { ascending: false }).limit(5);
      payload = { verifications: v ?? [] };
      fields = ["selfie_url", "document_url"];
    } else if (data.kind === "messages") {
      const limit = data.limit ?? 50;
      let q: any = sa.from("messages")
        .select("id,conversation_id,sender_id,body,media_url,caption,created_at,deleted_at")
        .order("created_at", { ascending: false }).limit(limit);
      if (data.conversationId) q = q.eq("conversation_id", data.conversationId);
      else q = q.or(`sender_id.eq.${data.targetUserId}`);
      const { data: msgs } = await q;
      payload = { messages: msgs ?? [] };
      fields = ["body", "media_url", "caption"];
    }

    // 3) Logare dublă (sensitive + audit critic).
    const meta = await reqMeta();
    await sa.from("admin_sensitive_access_log").insert({
      actor_id: context.userId,
      target_user_id: data.targetUserId,
      kind: data.kind, fields,
      justification: data.justification,
      ip: meta.ip, user_agent: meta.ua,
    });
    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: `break_glass.${data.kind}`,
      target_table: "profiles",
      target_id: data.targetUserId,
      justification: data.justification,
      severity: "critical",
      ip: meta.ip, user_agent: meta.ua,
      after_data: { fields },
    });

    return { ok: true as const, kind: data.kind, payload };
  });

/** Listă acces break-glass — vizibilă doar super_admin / auditor (RLS impune). */
export const adminListBreakGlass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId, _roles: ["super_admin", "auditor"],
    });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as any)
      .from("admin_sensitive_access_log")
      .select("*").order("created_at", { ascending: false }).limit(data.limit ?? 200);
    return { rows: rows ?? [] };
  });
