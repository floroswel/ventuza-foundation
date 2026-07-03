/**
 * Admin — reset propriu age_status.
 * Permite unui admin să-și readucă `age_status` la `unverified` pentru
 * a reface fluxul Didit curat. Auditat în `admin_audit_log`.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: staff role required");
}

export const adminResetOwnAgeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);

    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server");
    const sa = _sa as any;

    const { data: before } = await sa
      .from("profiles")
      .select("age_status, age_verified_at")
      .eq("id", context.userId)
      .maybeSingle();

    const { error: updErr } = await sa
      .from("profiles")
      .update({ age_status: "unverified", age_verified_at: null })
      .eq("id", context.userId);
    if (updErr) throw new Error(updErr.message);

    // Curăț și încercările vechi de la Didit ca reluarea să fie curată.
    await sa.from("age_verifications").delete().eq("user_id", context.userId);

    let ip: string | null = null;
    let ua: string | null = null;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch {}
    try { ua = getRequestHeader("user-agent") ?? null; } catch {}

    await sa.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "self_reset_age_verification",
      target_table: "profiles",
      target_id: context.userId,
      before_data: before ?? null,
      after_data: { age_status: "unverified", age_verified_at: null },
      justification: "Admin self-service reset pentru a reface verificarea Didit.",
      severity: "warning",
      ip,
      user_agent: ua,
    });

    return { ok: true, before: before ?? null };
  });
