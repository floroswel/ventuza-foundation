// Durable local crash log — ring buffer în localStorage, fără terți.
// Folosit ca fallback de observability când Sentry nu e disponibil.

const KEY = "ventuza_crash_log_v1";
const MAX = 50;

export type CrashEntry = {
  ts: string;
  kind: "error" | "unhandledrejection" | "boundary" | "manual";
  message: string;
  stack?: string;
  url?: string;
  boundary?: string;
  ua?: string;
  appVersion?: string;
};

function readAll(): CrashEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as CrashEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: CrashEntry[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX)));
  } catch {
    /* quota */
  }
}

export function logCrash(entry: Omit<CrashEntry, "ts" | "ua" | "url" | "appVersion"> & Partial<Pick<CrashEntry, "url" | "ua" | "appVersion">>) {
  try {
    const full: CrashEntry = {
      ts: new Date().toISOString(),
      url: entry.url ?? (typeof window !== "undefined" ? window.location.href : undefined),
      ua: entry.ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : undefined),
      appVersion: entry.appVersion ?? (typeof window !== "undefined" ? (window as unknown as { __APP_VERSION__?: string }).__APP_VERSION__ : undefined),
      ...entry,
    };
    const all = readAll();
    all.push(full);
    writeAll(all);
  } catch {
    /* never throw from a crash logger */
  }
}

export function listCrashes(): CrashEntry[] {
  return readAll().slice().reverse();
}

export function clearCrashes() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

let installed = false;
export function installGlobalCrashHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (ev) => {
    logCrash({
      kind: "error",
      message: ev.message || String(ev.error ?? "unknown"),
      stack: ev.error instanceof Error ? ev.error.stack : undefined,
    });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    logCrash({
      kind: "unhandledrejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
