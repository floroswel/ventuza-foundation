/**
 * Server functions pentru fluxul Didit (age verification).
 * `startDiditVerification` — creează sesiune Didit + o leagă de user.
 * `getMyDiditStatus`      — citește statusul curent pentru profil (poll UI).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  returnUrl: z.string().url(),
});

export const startDiditVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    const { diditCreateSession } = await import("./didit.server");

    const session = await diditCreateSession({
      vendorData: context.userId,
      callbackUrl: data.returnUrl,
    });

    const workflowId = process.env.DIDIT_WORKFLOW_ID ?? null;

    const { error } = await context.supabase.rpc("didit_link_session", {
      _session_id: session.session_id,
      _workflow_id: workflowId ?? session.workflow_id ?? "",
      _session_url: session.url,
    });
    if (error) throw new Error(error.message);

    return {
      sessionId: session.session_id,
      url: session.url,
    };
  });

export const getMyDiditStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profileRes, sessionRes] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("age_status, age_verified_at, age_provider")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("didit_sessions")
        .select("session_id, status, result, estimated_age, session_url, created_at, resolved_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      profile: profileRes.data ?? null,
      lastSession: sessionRes.data ?? null,
    };
  });

/**
 * Forțează sincronizarea statusului din Didit (folosit când webhook-ul nu a
 * ajuns — ex. în preview / dev fără tunel public). Cere decizia curentă de
 * la Didit pentru ultima sesiune a userului și o aplică prin RPC.
 */
export const syncMyDiditStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: session, error: sErr } = await context.supabase
      .from("didit_sessions")
      .select("session_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session?.session_id) return { ok: false, reason: "no_session" as const };

    const { diditFetchDecision, mapDiditStatus } = await import("./didit.server");
    const decision = await diditFetchDecision(session.session_id);
    if (!decision) return { ok: false, reason: "not_found" as const };

    const mapped = mapDiditStatus(decision.status);

    const raw = decision.raw as {
      decision?: { age_estimation?: { age?: number; estimated_age?: number; min_age?: number } };
      age_estimation?: { age?: number; estimated_age?: number; min_age?: number };
    };
    const candidates = [
      raw?.decision?.age_estimation?.estimated_age,
      raw?.decision?.age_estimation?.age,
      raw?.decision?.age_estimation?.min_age,
      raw?.age_estimation?.estimated_age,
      raw?.age_estimation?.age,
      raw?.age_estimation?.min_age,
    ];
    let estimatedAge: number | null = null;
    for (const c of candidates) {
      if (typeof c === "number" && Number.isFinite(c)) {
        estimatedAge = Math.round(c);
        break;
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("didit_apply_result", {
      _session_id: session.session_id,
      _status: mapped.status,
      _result: mapped.result,
      _estimated_age: estimatedAge as number,
      _status_raw: decision.raw as never,
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, status: mapped.status, result: mapped.result };
  });
