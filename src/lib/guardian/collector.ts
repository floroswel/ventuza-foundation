/**
 * Guardian — colector runtime (client only).
 *
 * Instalează monitorizarea permanentă: erori JS, promise rejections, erori
 * de rețea (fetch), resurse care nu se încarcă (imagini/scripturi), erori
 * console, evenimente de rută 404, offline/online, plus breadcrumbs cu
 * ultimele acțiuni ale utilizatorului înainte de eroare.
 *
 * Trimiterea se face batch, prin RPC `guardian_ingest` (SECURITY DEFINER,
 * rate-limited server-side). Payload-ul este redactat de `core.ts` — fără
 * token-uri, email, telefon, coordonate sau conținut de mesaj.
 */
import {
  classify,
  decide,
  fingerprint,
  redact,
  safeUrl,
  severityFor,
  type GuardianCategory,
  type GuardianSeverity,
} from "./core";
import { runAutoRepair } from "./auto-repair";

type Breadcrumb = { t: string; type: string; label: string };

const BREADCRUMBS: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 20;
const SEEN = new Map<string, number>();
const MAX_PER_FINGERPRINT = 5;

let installed = false;
let queue: Array<Record<string, unknown>> = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

// Lazy: workerd interzice crypto.randomUUID() / Math.random() în global scope,
// iar bundle-ul SSR importă acest modul → crash la orice request.
let _requestId: string | undefined;
export function requestId(): string {
  if (!_requestId) {
    _requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  return _requestId;
}

export function breadcrumb(type: string, label: string) {
  BREADCRUMBS.push({ t: new Date().toISOString(), type, label: redact(label, 160) });
  if (BREADCRUMBS.length > MAX_BREADCRUMBS) BREADCRUMBS.shift();
}

function platform(): string {
  if (typeof navigator === "undefined") return "server";
  const ua = navigator.userAgent || "";
  const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  if (cap?.getPlatform) return `capacitor:${cap.getPlatform()}`;
  if (/android/i.test(ua)) return "android-web";
  if (/iphone|ipad/i.test(ua)) return "ios-web";
  return "web";
}

function clientInfo(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent || "";
  // păstrăm doar familia de browser/OS, nu UA-ul complet (fingerprintable)
  const m = ua.match(/(Chrome|Firefox|Safari|Edg|SamsungBrowser)\/[\d.]+/);
  const os = ua.match(/(Android [\d.]+|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+|Linux)/);
  return [os?.[0], m?.[0]].filter(Boolean).join(" · ").slice(0, 120);
}

function appVersion(): string {
  const w = globalThis as { __APP_VERSION__?: string };
  return w.__APP_VERSION__ ?? "dev";
}

function environment(): string {
  if (typeof window === "undefined") return "server";
  const h = window.location.hostname;
  if (h === "suzeta.app" || h === "www.suzeta.app" || h === "ventuza.app") return "production";
  if (/lovableproject\.com|-dev\.lovable\.app|id-preview/.test(h)) return "preview";
  return "development";
}

async function flush() {
  flushTimer = undefined;
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return; // ingest doar pentru useri autentificați
    for (const row of batch) {
      await supabase.rpc("guardian_ingest" as never, row as never);
    }
  } catch {
    /* observability nu are voie să arunce */
  }
}

function schedule() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flush(), 2500);
}

export type CaptureInput = {
  message: string;
  stack?: string;
  category?: GuardianCategory;
  severity?: GuardianSeverity;
  context?: Record<string, unknown>;
  /** dezactivează auto-repararea (ex: apel din interiorul unei reparări) */
  noRepair?: boolean;
};

/** Punctul unic de captură. Sigur de apelat de oriunde — nu aruncă niciodată. */
export function capture(input: CaptureInput) {
  try {
    if (typeof window === "undefined") return;
    const message = redact(input.message, 500) || "unknown error";
    const category = classify(message, input.category);
    const severity = input.severity ?? severityFor(category, message);
    const fp = fingerprint(category, message, input.stack);

    const count = (SEEN.get(fp) ?? 0) + 1;
    SEEN.set(fp, count);
    if (count > MAX_PER_FINGERPRINT) return; // anti-flood pe sesiune

    const plan = decide({ category, severity, message, occurrences: count });

    queue.push({
      _fingerprint: fp,
      _severity: severity,
      _category: category,
      _message: message,
      _stack: redact(input.stack, 6000),
      _route: typeof window !== "undefined" ? window.location.pathname : null,
      _app_version: appVersion(),
      _platform: platform(),
      _client_info: clientInfo(),
      _request_id: REQUEST_ID,
      _breadcrumbs: BREADCRUMBS.slice(-MAX_BREADCRUMBS),
      _context: {
        ...(input.context ?? {}),
        decision: plan.decision,
        auto_action: plan.action,
        occurrences_session: count,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      },
      _environment: environment(),
    });
    schedule();

    if (!input.noRepair && plan.autoSafe && plan.action !== "none") {
      void runAutoRepair(plan);
    }
  } catch {
    /* noop */
  }
}

export function installGuardian() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (target && target !== (window as unknown as HTMLElement) && "tagName" in target) {
      const tag = target.tagName?.toLowerCase();
      if (tag === "img" || tag === "script" || tag === "link") {
        capture({
          message: `Resursă neîncărcată: ${tag}`,
          category: tag === "img" ? "photos" : "javascript",
          context: { src: safeUrl((target as HTMLImageElement).src ?? "") },
        });
        return;
      }
    }
    capture({
      message: ev.message || String(ev.error ?? "unknown"),
      stack: ev.error instanceof Error ? ev.error.stack : undefined,
      category: "javascript",
    });
  }, true);

  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    capture({
      message: r instanceof Error ? r.message : String(r),
      stack: r instanceof Error ? r.stack : undefined,
      category: "promise",
    });
  });

  window.addEventListener("offline", () => breadcrumb("network", "offline"));
  window.addEventListener("online", () => breadcrumb("network", "online"));
  window.addEventListener("visibilitychange", () =>
    breadcrumb("app", `visibility:${document.visibilityState}`),
  );
  window.addEventListener("click", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el) return;
    const label =
      el.getAttribute?.("aria-label") ||
      el.getAttribute?.("data-testid") ||
      el.tagName?.toLowerCase();
    breadcrumb("ui", `click:${label}`);
  }, true);
  window.addEventListener("beforeunload", () => void flush());

  // fetch — captăm doar eșecuri (fără payload)
  if (typeof window.fetch === "function") {
    const orig = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const raw =
        typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof URL
            ? args[0].toString()
            : (args[0] as Request).url;
      const url = safeUrl(raw);
      const method =
        (args[1] as RequestInit | undefined)?.method ??
        (typeof args[0] === "object" && args[0] && "method" in args[0]
          ? (args[0] as Request).method
          : "GET");
      const started = Date.now();
      try {
        const res = await orig(...args);
        if (!res.ok && res.status >= 400) {
          breadcrumb("net", `${method} ${url} → ${res.status}`);
          // 401/403 pe endpointuri Supabase sunt semnal de sesiune/RLS
          capture({
            message: `${method} ${url} → ${res.status}`,
            category: res.status === 401 ? "session" : res.status >= 500 ? "api" : "api",
            severity: res.status >= 500 ? "high" : "medium",
            context: { status: res.status, ms: Date.now() - started },
          });
        }
        return res;
      } catch (e) {
        breadcrumb("net", `${method} ${url} → FAIL`);
        capture({
          message: `${method} ${url} → ${(e as Error)?.message ?? "network failure"}`,
          category: "network",
          context: { ms: Date.now() - started },
        });
        throw e;
      }
    };
  }

  breadcrumb("app", `boot:${environment()}:${appVersion()}`);
}

/** Test hook — golește starea internă. */
export function __resetGuardianForTests() {
  SEEN.clear();
  BREADCRUMBS.length = 0;
  queue = [];
}
