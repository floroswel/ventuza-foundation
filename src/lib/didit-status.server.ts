import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DiditReason, DiditStatusResponse, DiditSyncResponse } from "@/lib/didit-types";

export async function getDiditStatusForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DiditStatusResponse> {
  const [profileRes, sessionRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("age_status, age_verified_at, age_provider")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("didit_sessions")
      .select("session_id, status, result, estimated_age, session_url, created_at, resolved_at, status_raw")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (sessionRes.error) throw new Error(sessionRes.error.message);

  const session = sessionRes.data ?? null;
  let reasonCode: DiditReason = "unknown";
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
}

export async function syncDiditStatusForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DiditSyncResponse> {
  const { data: sessions, error: sessionError } = await supabase
    .from("didit_sessions")
    .select("session_id, resolved_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (sessionError) throw new Error(sessionError.message);
  if (!sessions || sessions.length === 0) return { ok: false, reason: "no_session" };

  const toCheck = sessions.filter((s) => !s.resolved_at).map((s) => s.session_id);
  if (toCheck.length === 0) {
    const latestSessionId = sessions[0]?.session_id;
    if (!latestSessionId) return { ok: false, reason: "no_session" };
    toCheck.push(latestSessionId);
  }

  const { diditFetchDecision, extractDiditEstimatedAge, mapDiditStatus, sanitizeDiditStatusRaw } = await import(
    "./didit.server"
  );
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
        _estimated_age: estimatedAge,
        _status_raw: statusRaw,
      });
      if (error) {
        lastError = error.message;
        continue;
      }
      if (mapped.result === "pass" || mapped.result === "fail") {
        applied = { session_id: sessionId, status: mapped.status, result: mapped.result };
        break;
      }
      if (!applied) applied = { session_id: sessionId, status: mapped.status, result: mapped.result };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!applied) return { ok: false, reason: "no_decision", error: lastError };
  return { ok: true, ...applied };
}
