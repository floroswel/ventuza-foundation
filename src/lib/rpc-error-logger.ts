import { supabase } from "@/integrations/supabase/client";
import { reportLovableError } from "./lovable-error-reporting";

/**
 * Centralized logger for RPC / PostgREST "permission denied" style failures.
 *
 * Captures enough context to identify rapidly WHICH role / token was used
 * (without ever logging the token itself), and forwards to:
 *   1. console.error (structured group) — visible în devtools / browser logs
 *   2. window.__lovableEvents.captureException — Sentry-like sink folosit de
 *      restul codului (vezi `reportLovableError`).
 *
 * NICIODATĂ nu loghează:
 *   - `access_token` / `refresh_token` (doar lungimea + ultimele 4 chars)
 *   - email-ul userului (doar `user_id` și `role` din claims)
 */

export type RpcErrorContext = {
  /** Numele RPC-ului / server-fn-ului / tabelului. Ex: "nearby_points", "reports.insert". */
  rpc: string;
  /** Eticheta call site (opțional). Ex: "ReportBlockDialog.submit". */
  callSite?: string;
  /** Extras arbitrari (id-uri non-sensibile, parametri non-PII). */
  extra?: Record<string, unknown>;
};

type ParsedError = {
  message: string;
  code?: string;
  status?: number;
  hint?: string;
  details?: string;
};

const PERMISSION_PATTERNS = [
  "permission denied",
  "permission_denied",
  "row-level security",
  "row level security",
  "rls",
  "forbidden",
  "unauthorized",
  "not authorized",
  "401",
  "403",
  "42501",
  "jwt",
];

function parseError(error: unknown): ParsedError {
  if (!error) return { message: "unknown error" };
  if (typeof error === "string") return { message: error };
  const e = error as Record<string, unknown>;
  return {
    message: String(e.message ?? e.error_description ?? e),
    code: e.code ? String(e.code) : undefined,
    status: typeof e.status === "number" ? (e.status as number) : undefined,
    hint: e.hint ? String(e.hint) : undefined,
    details: e.details ? String(e.details) : undefined,
  };
}

export function isPermissionDenied(error: unknown): boolean {
  const parsed = parseError(error);
  const haystack = `${parsed.message} ${parsed.code ?? ""} ${parsed.status ?? ""}`.toLowerCase();
  return PERMISSION_PATTERNS.some((p) => haystack.includes(p));
}

/** Decode JWT payload safely (no signature check — read-only for diagnostics). */
function decodeJwtClaims(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenFingerprint(token: string | undefined): string | null {
  if (!token) return null;
  return `len=${token.length}…${token.slice(-4)}`;
}

async function gatherAuthDiagnostics() {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const access = session?.access_token;
    const claims = decodeJwtClaims(access);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = (claims?.exp as number | undefined) ?? session?.expires_at;
    return {
      has_session: !!session,
      user_id: session?.user?.id ?? null,
      // role din JWT (authenticated / anon / service_role) — sursa de adevăr pentru RLS
      jwt_role: (claims?.role as string | undefined) ?? null,
      jwt_aud: (claims?.aud as string | undefined) ?? null,
      jwt_iss: (claims?.iss as string | undefined) ?? null,
      app_role: (claims?.app_metadata as { provider?: string; role?: string } | undefined)?.role ?? null,
      provider:
        (claims?.app_metadata as { provider?: string } | undefined)?.provider ?? session?.user?.app_metadata?.provider ?? null,
      access_token_fingerprint: tokenFingerprint(access),
      has_refresh_token: !!session?.refresh_token,
      token_expires_at: expiresAt ?? null,
      token_expired: typeof expiresAt === "number" ? expiresAt <= now : null,
      seconds_until_expiry: typeof expiresAt === "number" ? expiresAt - now : null,
    };
  } catch (err) {
    return { auth_probe_error: String((err as Error)?.message ?? err) };
  }
}

/**
 * Loghează o eroare RPC + diagnostic auth. Sigur să apelezi pentru ORICE
 * eroare — filtrează intern. Întoarce `true` dacă a fost clasificată ca
 * permission-denied (util pentru telemetrie suplimentară la call site).
 */
export async function logRpcError(error: unknown, ctx: RpcErrorContext): Promise<boolean> {
  const parsed = parseError(error);
  const denied = isPermissionDenied(error);
  const auth = await gatherAuthDiagnostics();

  const payload = {
    kind: denied ? "rpc_permission_denied" : "rpc_error",
    rpc: ctx.rpc,
    call_site: ctx.callSite ?? null,
    route: typeof window !== "undefined" ? window.location.pathname : null,
    error: parsed,
    auth,
    extra: ctx.extra ?? null,
    ts: new Date().toISOString(),
  };

  if (denied) {
    // group collapsed pentru lizibilitate, dar marcat ca error
    // eslint-disable-next-line no-console
    console.error(`[RPC denied] ${ctx.rpc}`, payload);
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[RPC error] ${ctx.rpc}`, payload);
  }

  reportLovableError(error instanceof Error ? error : new Error(parsed.message), payload);
  return denied;
}
