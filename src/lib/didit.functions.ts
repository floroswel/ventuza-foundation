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
    // Luăm TOATE sesiunile nerezolvate ale userului (nu doar ultima), plus ultima
    // rezolvată — Didit poate aproba/decline o sesiune mai veche (ex. review manual).
    const { data: sessions, error: sErr } = await context.supabase
      .from("didit_sessions")
      .select("session_id, resolved_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (sErr) throw new Error(sErr.message);
    if (!sessions || sessions.length === 0) {
      return { ok: false, reason: "no_session" as const };
    }

    const toCheck = sessions.filter((s) => !s.resolved_at).map((s) => s.session_id);
    // Fallback: dacă toate sunt rezolvate, verificăm oricum ultima ca să prindem
    // corecții post-review manual.
    if (toCheck.length === 0) toCheck.push(sessions[0]!.session_id);

    const {
      diditFetchDecision,
      extractDiditEstimatedAge,
      mapDiditStatus,
      sanitizeDiditStatusRaw,
    } = await import("./didit.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let applied: { session_id: string; status: string; result: string } | null = null;
    let lastError: string | null = null;

    for (const sessionId of toCheck) {
      try {
        const decision = await diditFetchDecision(sessionId);
        if (!decision) continue;
        const mapped = mapDiditStatus(decision.status);
        const estimatedAge = extractDiditEstimatedAge(decision.raw);
        const statusRaw = sanitizeDiditStatusRaw(decision.raw);

        const { error } = await supabaseAdmin.rpc("didit_apply_result", {
          _session_id: sessionId,
          _status: mapped.status,
          _result: mapped.result,
          _estimated_age: estimatedAge as number,
          _status_raw: statusRaw as never,
        });
        if (error) {
          lastError = error.message;
          continue;
        }
        // Preferăm o rezoluție "pass"/"fail" — dacă am aplicat una, ne oprim.
        if (mapped.result === "pass" || mapped.result === "fail") {
          applied = { session_id: sessionId, status: mapped.status, result: mapped.result };
          break;
        }
        if (!applied) {
          applied = { session_id: sessionId, status: mapped.status, result: mapped.result };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!applied) return { ok: false as const, reason: "no_decision" as const, error: lastError };
    return { ok: true as const, ...applied };
  });
