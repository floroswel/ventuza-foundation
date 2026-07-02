/**
 * Telemetrie pentru eșecurile de încărcare din panourile admin SLA.
 *
 * Clasifică eroarea în categorii acționabile (auth / forbidden / network /
 * timeout / schema / server / unknown) și o trimite prin `logRpcError` către
 * console + Lovable error sink, cu context suficient pentru diagnostic
 * (RPC, call site, ruta curentă, dacă e primul load sau un refresh, dacă
 * încă avem date vechi vizibile). Nu loghează niciodată tokenul, doar
 * fingerprint-ul + claims-urile relevante pentru RLS.
 */
import { logRpcError, isPermissionDenied } from "@/lib/rpc-error-logger";

export type SlaFailureKind =
  | "forbidden"
  | "network"
  | "timeout"
  | "schema"
  | "server"
  | "aborted"
  | "unknown";

export function classifySlaFailure(error: unknown): SlaFailureKind {
  if (!error) return "unknown";
  if (isPermissionDenied(error)) return "forbidden";
  const raw = error instanceof Error ? error.message : String(error);
  const msg = raw.toLowerCase();
  if (/abort|cancell?ed/.test(msg)) return "aborted";
  if (/timeout|timed out|deadline|etimedout/.test(msg)) return "timeout";
  if (/network|failed to fetch|load failed|dns|econnrefused|offline/.test(msg))
    return "network";
  if (/schema|column|relation .* does not exist|type mismatch|42p01|42703/.test(msg))
    return "schema";
  if (/\b(5\d{2})\b|internal server|bad gateway|service unavailable/.test(msg)) return "server";
  return "unknown";
}

export type SlaFailureContext = {
  /** Numele RPC-ului sau server-fn-ului care a eșuat. */
  rpc: string;
  /** Componenta din care a fost apelat (ex: "SupportTicketsPanel.sla"). */
  callSite: string;
  /** True dacă panoul nu are date de afișat (primul load). */
  fatal: boolean;
  /** True dacă a mai fost o încărcare reușită înainte. */
  hasLoadedOnce: boolean;
  /** Duratele apelului, în ms (opțional). */
  durationMs?: number;
};

export async function reportSlaFailure(
  error: unknown,
  ctx: SlaFailureContext,
): Promise<SlaFailureKind> {
  const kind = classifySlaFailure(error);
  await logRpcError(error, {
    rpc: ctx.rpc,
    callSite: ctx.callSite,
    extra: {
      sla_failure_kind: kind,
      fatal: ctx.fatal,
      has_loaded_once: ctx.hasLoadedOnce,
      duration_ms: ctx.durationMs ?? null,
    },
  });
  return kind;
}
