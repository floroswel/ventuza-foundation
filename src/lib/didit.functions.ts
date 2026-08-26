/**
 * Server functions pentru fluxul Didit (age verification).
 * `startDiditVerification` — creează sesiune Didit + o leagă de user.
 * `getMyDiditStatus`      — citește statusul curent pentru profil (poll UI).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startDiditVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ returnUrl: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: hasConsent, error: consentError } = await context.supabase.rpc(
      "has_active_consent",
      { _user_id: context.userId, _kind: "age_verification" },
    );
    if (consentError || hasConsent !== true) throw new Error("age_verification_consent_required");
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

    // Audit: pornirea sesiunii de verificare.
    await context.supabase
      .rpc("record_account_flow_event", {
        _kind: "didit",
        _stage: "session_started",
        _detail: { has_url: Boolean(session.url) } as never,
      })
      .then(() => undefined, () => undefined);

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
        .select(
          "session_id, status, result, estimated_age, session_url, created_at, resolved_at, status_raw",
        )
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const session = sessionRes.data ?? null;
    // Derivăm un cod de motiv pentru UI. `status_raw` e non-null doar dacă
    // webhook-ul sau syncul a aplicat vreodată o decizie pe sesiune.
    let reasonCode:
      | "verified"
      | "no_session"
      | "awaiting_user"
      | "no_webhook_event"
      | "in_review"
      | "pending_provider"
      | "failed"
      | "expired"
      | "declined"
      | "unknown" = "unknown";
    if (profileRes.data?.age_status === "verified") reasonCode = "verified";
    else if (!session) reasonCode = "no_session";
    else {
      const s = String(session.status ?? "").toLowerCase();
      const hasEvent = session.status_raw != null;
      if (s === "declined") reasonCode = "declined";
      else if (s === "expired" || s === "kyc_expired") reasonCode = "expired";
      else if (s === "abandoned") reasonCode = "failed";
      else if (s === "in_review") reasonCode = "in_review";
      else if (s === "created" && !hasEvent) reasonCode = "no_webhook_event";
      else if (s === "created" && hasEvent) reasonCode = "awaiting_user";
      else reasonCode = "pending_provider";
    }

    return {
      profile: profileRes.data ?? null,
      lastSession: session
        ? {
            session_id: session.session_id,
            status: session.status,
            result: session.result,
            estimated_age: session.estimated_age,
            session_url: session.session_url,
            created_at: session.created_at,
            resolved_at: session.resolved_at,
            webhook_received: session.status_raw != null,
          }
        : null,
      reasonCode,
      lastUpdatedAt:
        session?.resolved_at ??
        profileRes.data?.age_verified_at ??
        session?.created_at ??
        null,
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
