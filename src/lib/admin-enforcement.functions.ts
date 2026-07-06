/**
 * Admin enforcement: strikes progresive, ban temporar, legal hold,
 * atribuire moderator, mesaj oficial in-app.
 *
 * Toate mutațiile audit + MFA (via `assertAdminMfa`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminMfa } from "@/lib/admin-mfa-guard";

async function assertStaff(sb: any, uid: string) {
  const { data } = await sb.rpc("is_staff", { _uid: uid });
  if (!data) throw new Error("Forbidden: rol staff necesar.");
}
async function assertAdmin(sb: any, uid: string) {
  const { data } = await sb.rpc("has_any_role", { _user_id: uid, _roles: ["admin", "super_admin"] });
  if (!data) throw new Error("Forbidden: rol admin/super_admin necesar.");
}
async function assertSuper(sb: any, uid: string) {
  const { data } = await sb.rpc("has_role", { _user_id: uid, _role: "super_admin" });
  if (!data) throw new Error("Forbidden: super_admin necesar.");
}

/* ---------- STRIKES ---------- */
const StrikeInput = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(5).max(500),
  reasonCode: z.string().max(64).optional(),
  severity: z.number().int().min(1).max(5).optional(),
});
export const adminApplyStrike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StrikeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { data: res, error } = await (context.supabase as any).rpc("admin_apply_strike", {
      _target: data.userId,
      _reason: data.reason,
      _reason_code: data.reasonCode ?? null,
      _severity: data.severity ?? null,
    });
    if (error) throw new Error(error.message);
    return { result: res };
  });

const ListStrikesInput = z.object({ userId: z.string().uuid() });
export const adminGetUserStrikes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListStrikesInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = context.supabase as any;
    const [active, all] = await Promise.all([
      sb.rpc("get_active_strikes", { _user_id: data.userId }),
      sb.from("user_strikes")
        .select("id,severity,reason,reason_code,issued_by,decay_at,revoked_at,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return { active: active.data ?? [], history: all.data ?? [] };
  });

/* ---------- TEMPORARY BAN ---------- */
const BanInput = z.object({
  userId: z.string().uuid(),
  until: z.string().datetime().nullable(),
  reason: z.string().min(10).max(500),
});
export const adminSetTemporaryBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BanInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { error } = await (context.supabase as any).rpc("admin_set_temporary_ban", {
      _target: data.userId,
      _until: data.until,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- LEGAL HOLD ---------- */
const LegalHoldInput = z.object({
  userId: z.string().uuid(),
  enable: z.boolean(),
  reason: z.string().min(10).max(500),
});
export const adminSetLegalHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LegalHoldInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { error } = await (context.supabase as any).rpc("admin_set_legal_hold", {
      _target: data.userId,
      _enable: data.enable,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- ASSIGN MODERATOR ---------- */
const AssignInput = z.object({
  kind: z.enum(["report", "verification"]),
  itemId: z.string().uuid(),
  moderatorId: z.string().uuid().nullable(),
});
export const adminAssignModerator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssignInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await (context.supabase as any).rpc("admin_assign_moderator", {
      _kind: data.kind,
      _item_id: data.itemId,
      _moderator: data.moderatorId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- OFFICIAL MESSAGE ---------- */
const OfficialMsgInput = z.object({
  userId: z.string().uuid(),
  body: z.string().min(3).max(4000),
  subject: z.string().max(120).optional(),
});
export const adminSendOfficialMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OfficialMsgInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    await assertAdminMfa(context.userId);
    const { data: msgId, error } = await (context.supabase as any).rpc("admin_send_official_message", {
      _target: data.userId,
      _body: data.body,
      _subject: data.subject ?? null,
    });
    if (error) throw new Error(error.message);
    return { messageId: msgId as string };
  });

/* ---------- LIST STAFF (for assign dropdown) ---------- */
export const adminListStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("user_id,role")
      .in("role", ["moderator", "admin", "super_admin"]);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", ids);
      names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name ?? "—"]));
    }
    const staff = (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      role: r.role,
      display_name: names[r.user_id] ?? "—",
    }));
    return { staff };
  });
