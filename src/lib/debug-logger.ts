// Debug logger — mod „loguri detaliate" pentru user.
//
// Captează într-un ring buffer (max 500 intrări) evenimente relevante pentru
// diagnostic: erori JS, promise rejections, console.error / console.warn,
// erori de rețea (fetch/XHR non-2xx), toast-uri de eroare, evenimente custom
// „suzeta:*" emise de PrivacyScreen și showAuthErrorToast, plus navigări.
//
// Se activează manual — nu culege nimic dacă modul e OFF.
// Toggle: localStorage["suzeta_debug_mode"] = "1" | "0"
//         sau URL: ?debug=1  /  ?debug=0
//
// Export: JSON structurat sau text plain, gata de trimis la suport.

export type DebugEntryLevel = "error" | "warn" | "info" | "network" | "event" | "nav";

export interface DebugEntry {
  ts: string;            // ISO timestamp
  level: DebugEntryLevel;
  source: string;        // ex: "console", "window.error", "fetch", "toast", "suzeta:privacy-blocked"
  message: string;
  details?: unknown;     // stack, status, url, target, etc.
}

const STORAGE_KEY = "suzeta_debug_mode";
const MAX_ENTRIES = 500;
const LISTENERS = new Set<(entries: DebugEntry[]) => void>();
const buffer: DebugEntry[] = [];
let installed = false;

// ————————————————— toggle & state —————————————————

export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // URL override wins (once set, we also persist it)
    const params = new URLSearchParams(window.location.search);
    const q = params.get("debug");
    if (q === "1" || q === "0") {
      try {
        window.localStorage.setItem(STORAGE_KEY, q);
      } catch {
        /* noop */
      }
      return q === "1";
    }
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDebugEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* noop */
  }
  if (on) {
    installOnce();
    log({ level: "info", source: "debug", message: "Debug mode activat." });
  } else {
    log({ level: "info", source: "debug", message: "Debug mode dezactivat." });
  }
  window.dispatchEvent(new CustomEvent("suzeta:debug-toggle", { detail: { on } }));
}

// ————————————————— buffer API —————————————————

export function log(entry: Omit<DebugEntry, "ts">) {
  if (!isDebugEnabled()) return;
  const e: DebugEntry = { ts: new Date().toISOString(), ...entry };
  buffer.push(e);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  for (const l of LISTENERS) {
    try {
      l(buffer.slice());
    } catch {
      /* noop */
    }
  }
}

export function getEntries(): DebugEntry[] {
  return buffer.slice();
}

export function clearEntries() {
  buffer.length = 0;
  for (const l of LISTENERS) l([]);
}

export function subscribe(fn: (entries: DebugEntry[]) => void): () => void {
  LISTENERS.add(fn);
  fn(buffer.slice());
  return () => {
    LISTENERS.delete(fn);
  };
}

// ————————————————— export helpers —————————————————

export function buildSnapshot() {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  return {
    generated_at: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : null,
    user_agent: nav.userAgent ?? null,
    language: nav.language ?? null,
    viewport:
      typeof window !== "undefined"
        ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
        : null,
    entries_count: buffer.length,
    entries: buffer.slice(),
  };
}

export function exportAsJson(): Blob {
  return new Blob([JSON.stringify(buildSnapshot(), null, 2)], { type: "application/json" });
}

export function exportAsText(): Blob {
  const snap = buildSnapshot();
  const header = [
    `# Suzeta debug log`,
    `Generated: ${snap.generated_at}`,
    `URL:       ${snap.url ?? "-"}`,
    `UA:        ${snap.user_agent ?? "-"}`,
    `Language:  ${snap.language ?? "-"}`,
    snap.viewport ? `Viewport:  ${snap.viewport.w}x${snap.viewport.h} @${snap.viewport.dpr}dpr` : "",
    `Entries:   ${snap.entries_count}`,
    ``,
    `--- events ---`,
  ]
    .filter(Boolean)
    .join("\n");
  const body = snap.entries
    .map((e) => {
      const det =
        e.details === undefined
          ? ""
          : "\n    " + JSON.stringify(e.details).slice(0, 500);
      return `[${e.ts}] ${e.level.toUpperCase()} ${e.source}: ${e.message}${det}`;
    })
    .join("\n");
  return new Blob([header + "\n" + body + "\n"], { type: "text/plain;charset=utf-8" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ————————————————— capture hooks —————————————————

function safeStr(v: unknown): string {
  if (v instanceof Error) return v.message;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function installOnce() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // console
  const origErr = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    log({
      level: "error",
      source: "console.error",
      message: args.map(safeStr).join(" ").slice(0, 400),
      details: args.length > 1 ? args.slice(1) : undefined,
    });
    origErr(...args);
  };
  console.warn = (...args: unknown[]) => {
    log({
      level: "warn",
      source: "console.warn",
      message: args.map(safeStr).join(" ").slice(0, 400),
    });
    origWarn(...args);
  };

  // unhandled errors
  window.addEventListener("error", (ev) => {
    log({
      level: "error",
      source: "window.error",
      message: ev.message || "unknown error",
      details: {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        stack: ev.error instanceof Error ? ev.error.stack : undefined,
      },
    });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    log({
      level: "error",
      source: "unhandledrejection",
      message: safeStr(reason).slice(0, 400),
      details: reason instanceof Error ? { stack: reason.stack } : undefined,
    });
  });

  // navigation (SPA + reload)
  let lastUrl = window.location.href;
  const emitNav = () => {
    if (window.location.href === lastUrl) return;
    log({ level: "nav", source: "navigation", message: window.location.pathname + window.location.search });
    lastUrl = window.location.href;
  };
  window.addEventListener("popstate", emitNav);
  window.addEventListener("hashchange", emitNav);
  // patch pushState/replaceState
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: Parameters<History[typeof m]>) {
      const ret = orig.apply(this, args);
      setTimeout(emitNav, 0);
      return ret;
    };
  }

  // fetch — captăm doar erori și non-2xx (nu payload-ul, ca să nu scurgem PII)
  if (typeof window.fetch === "function") {
    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const url =
        typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof URL
            ? args[0].toString()
            : (args[0] as Request).url;
      const method =
        typeof args[0] === "object" && args[0] !== null && "method" in args[0]
          ? (args[0] as Request).method
          : (args[1] as RequestInit | undefined)?.method ?? "GET";
      const started = performance.now();
      const isAuthRequest = /\/auth\/v1\//i.test(url);
      if (isAuthRequest) {
        log({
          level: "network",
          source: "auth.fetch",
          message: `${method} ${sanitizeUrl(url)} → REQUEST_STARTED`,
        });
      }
      try {
        const res = await origFetch(...args);
        if (isAuthRequest) {
          log({
            level: "network",
            source: "auth.fetch",
            message: `${method} ${sanitizeUrl(url)} → ${res.status}`,
            details: { ms: Math.round(performance.now() - started), statusText: res.statusText },
          });
        }
        if (!res.ok) {
          log({
            level: "network",
            source: "fetch",
            message: `${method} ${sanitizeUrl(url)} → ${res.status}`,
            details: { ms: Math.round(performance.now() - started) },
          });
        }
        return res;
      } catch (e) {
        log({
          level: "network",
          source: "fetch",
          message: `${method} ${sanitizeUrl(url)} → FAIL: ${safeStr(e).slice(0, 160)}`,
          details: { ms: Math.round(performance.now() - started) },
        });
        throw e;
      }
    };
  }

  // suzeta:* custom events (privacy-blocked, screenshot-detected, consent, debug-toggle etc.)
  const forward = (name: string) => {
    window.addEventListener(name, (ev) => {
      const detail = (ev as CustomEvent).detail;
      log({
        level: "event",
        source: name,
        message: name,
        details: detail,
      });
    });
  };
  [
    "suzeta:privacy-blocked",
    "suzeta:screenshot-detected",
    "suzeta:consent",
    "suzeta:auth-error",
    "suzeta:version-blocked",
  ].forEach(forward);
}

function sanitizeUrl(u: string): string {
  // păstrăm doar path-ul + host-ul; strippăm query-uri care pot conține token-uri
  try {
    const url = new URL(u, typeof window !== "undefined" ? window.location.origin : "http://x");
    return `${url.origin}${url.pathname}`;
  } catch {
    return u.slice(0, 160);
  }
}

// Bootstrap: dacă e activ din localStorage, instalăm imediat.
if (typeof window !== "undefined") {
  try {
    if (isDebugEnabled()) installOnce();
  } catch {
    /* noop */
  }
}
