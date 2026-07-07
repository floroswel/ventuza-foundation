// Telemetrie pentru URL-uri semnate + erori RLS/permisiuni.
//
// Toate helperele de semnare (profile-photos, stories, chat-media) și orice
// citire care se poate lovi de RLS trec prin utilitarele de aici. Loggerul
// central (`src/lib/debug-logger.ts`) captează evenimentele într-un ring buffer
// când modul debug este ON, iar `console.warn` face vizibile problemele și în
// DevTools pentru diagnostic rapid.

import { log } from "@/lib/debug-logger";

export type MediaSurface = "profile-photos" | "stories" | "chat-media" | "profile-media" | "venue-media" | string;

export interface SignedUrlEventBase {
  bucket: MediaSurface;
  path: string;
  context?: string; // ex: "discover", "story-viewer", "chat-bubble"
}

export interface SignedUrlErrorEvent extends SignedUrlEventBase {
  error?: unknown;
  status?: number;
}

// Detectează dacă un obiect de eroare Supabase seamănă cu o problemă RLS /
// permisiuni. Postgres întoarce coduri specifice; storage întoarce mesaje
// tipice ("permission denied", "not authorized", "row-level security", 401/403).
export function looksLikePermissionError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; status?: number; statusCode?: number | string; message?: string };
  const status = Number(e.status ?? e.statusCode ?? 0);
  if (status === 401 || status === 403) return true;
  const code = String(e.code ?? "").toLowerCase();
  if (code === "42501" || code === "pgrst301" || code === "pgrst302") return true;
  const msg = String(e.message ?? "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("not authorized") ||
    msg.includes("forbidden") ||
    msg.includes("jwt") ||
    msg.includes("access to storage")
  );
}

export function reportSignedUrlOk(evt: SignedUrlEventBase) {
  log({
    level: "info",
    source: "signed-url",
    message: `signed ok · ${evt.bucket}`,
    details: { path: evt.path, context: evt.context },
  });
}

export function reportSignedUrlMissing(evt: SignedUrlEventBase & { reason?: string }) {
  const message = `signed missing · ${evt.bucket} · ${evt.reason ?? "no url"}`;
  // Nu spamăm consola pentru fiecare miss, doar log intern.
  log({
    level: "warn",
    source: "signed-url",
    message,
    details: { path: evt.path, context: evt.context, reason: evt.reason },
  });
}

export function reportSignedUrlError(evt: SignedUrlErrorEvent) {
  const perm = looksLikePermissionError(evt.error);
  const err = evt.error as { message?: string; code?: string; status?: number } | undefined;
  const message =
    (perm ? "RLS/permission blocked" : "signed url error") +
    ` · ${evt.bucket}` +
    (err?.status ? ` · ${err.status}` : "") +
    (err?.code ? ` · ${err.code}` : "");
  // Vizibil și în consolă — permisiunile lipsă sunt aproape mereu un bug.
  try {
    // eslint-disable-next-line no-console
    (perm ? console.warn : console.warn).call(console, "[media]", message, {
      path: evt.path,
      context: evt.context,
      code: err?.code,
      status: err?.status,
      error: err?.message,
    });
  } catch {
    /* noop */
  }
  log({
    level: "error",
    source: "signed-url",
    message,
    details: {
      path: evt.path,
      context: evt.context,
      permission: perm,
      code: err?.code,
      status: err?.status,
      error: err?.message,
    },
  });
}

// Wrapper pentru orice citire Supabase care se poate lovi de RLS (rpc, select).
// Nu schimbă valoarea returnată — doar loghează atunci când `error` seamănă cu
// o problemă de permisiuni.
export function reportRlsIfAny<T extends { error: unknown } | null | undefined>(
  where: string,
  result: T,
): T {
  if (!result) return result;
  const err = (result as { error: unknown }).error;
  if (err && looksLikePermissionError(err)) {
    const e = err as { message?: string; code?: string; status?: number };
    try {
      // eslint-disable-next-line no-console
      console.warn("[rls]", where, e.code ?? "", e.status ?? "", e.message ?? "");
    } catch {
      /* noop */
    }
    log({
      level: "error",
      source: "rls",
      message: `RLS/permission · ${where}`,
      details: { code: e.code, status: e.status, error: e.message },
    });
  }
  return result;
}
