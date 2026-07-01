// Impersonation "View As" — safe snapshot (no session hijack), audited.
// Returns a read-only dossier of the target user's data, plus writes an
// entry into admin_impersonation_log for auditor review.
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

const StartIn = z.object({
  targetUserId: z.string().uuid(),
  purpose: z.enum(["support", "abuse_review", "bug_repro", "legal", "other"]),
  justification: z.string().min(20).max(2000),
  ticketId: z.string().uuid().nullable().optional(),
});
export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartIn.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;

    let ip: string | null = null, ua: string | null = null;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch {}
    try { ua = getRequestHeader("user-agent") ?? null; } catch {}

    // Log start
    const { data: log, error: logErr } = await sa.from("admin_impersonation_log").insert({
      actor_id: context.userId,
      target_user_id: data.targetUserId,
      purpose: data.purpose,
      justification: data.justification,
      ticket_id: data.ticketId ?? null,
      fields_accessed: ["profile_public", "conversations_meta", "matches_meta", "subscription", "recent_events"],
      ip, user_agent: ua,
    }).select("id, started_at").single();
    if (logErr) throw new Error(logErr.message);

    // Also mirror to admin_audit_log (critical)
    await sa.from("admin_audit_log").insert({
      actor_id: context.userId, action: "impersonation_start", target_table: "profiles",
      target_id: data.targetUserId, justification: data.justification,
      severity: "critical", ip, user_agent: ua,
      after_data: { purpose: data.purpose, ticket_id: data.ticketId ?? null, impersonation_id: log.id },
    });

    // Assemble non-sensitive dossier (no message bodies, no location, no encrypted health)
    const [prof, subs, roles, tickets, matches, convs, recentSwipes, recentReports, notif] = await Promise.all([
      sa.from("profiles")
        .select("id, display_name, email, username, birthdate, age_status, verified, banned_at, suspended_until, report_count, last_active_at, created_at, city, country, plan_code, partner_role, partner_suspended_at")
        .eq("id", data.targetUserId).maybeSingle(),
      sa.from("partner_subscriptions").select("*").eq("owner_id", data.targetUserId).order("current_period_end", { ascending: false }).limit(5),
      sa.from("user_roles").select("role").eq("user_id", data.targetUserId),
      sa.from("support_tickets").select("id, subject, status, priority, last_msg_at, created_at").eq("user_id", data.targetUserId).order("last_msg_at", { ascending: false }).limit(20),
      sa.from("matches").select("id, user_a, user_b, created_at").or(`user_a.eq.${data.targetUserId},user_b.eq.${data.targetUserId}`).order("created_at", { ascending: false }).limit(20),
      sa.from("conversations").select("id, participants, last_message_at, created_at").contains("participants", [data.targetUserId]).order("last_message_at", { ascending: false }).limit(20),
      sa.from("swipes").select("id, direction, created_at").eq("swiper_id", data.targetUserId).order("created_at", { ascending: false }).limit(50),
      sa.from("reports").select("id, reason, status, created_at").eq("reported_id", data.targetUserId).order("created_at", { ascending: false }).limit(20),
      sa.from("notifications").select("id, type, title, created_at, read_at").eq("user_id", data.targetUserId).order("created_at", { ascending: false }).limit(30),
    ]);

    return {
      impersonationId: log.id,
      startedAt: log.started_at,
      dossier: {
        profile: prof.data ?? null,
        subscriptions: subs.data ?? [],
        roles: (roles.data ?? []).map((r: any) => r.role),
        tickets: tickets.data ?? [],
        matchesCount: (matches.data ?? []).length,
        conversationsCount: (convs.data ?? []).length,
        recentSwipes: recentSwipes.data ?? [],
        reportsAgainst: recentReports.data ?? [],
        recentNotifications: notif.data ?? [],
      },
    };
  });

export const endImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ impersonationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    await sa.from("admin_impersonation_log").update({ ended_at: new Date().toISOString() })
      .eq("id", data.impersonationId).eq("actor_id", context.userId);
    return { ok: true };
  });

/* AUDITOR — recent impersonation activity */
export const adminListImpersonations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(500).default(200) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId, _roles: ["super_admin", "auditor"],
    });
    if (!ok) throw new Error("Forbidden: super_admin or auditor required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sa = supabaseAdmin as any;
    const { data: rows, error } = await sa.from("admin_impersonation_log")
      .select("*").order("started_at", { ascending: false }).limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
