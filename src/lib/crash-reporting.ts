/**
 * Crash reporting fără terți.
 *
 * - captează `error` + `unhandledrejection` la nivel global,
 * - scrie în ring-buffer-ul local (`crash-log`) pentru inspecție pe device,
 * - trimite best-effort în `public.client_errors` (dacă tabela există) ca să
 *   putem vedea problemele de pe device-uri reale în admin,
 * - deduplică erorile identice într-o fereastră scurtă, ca să nu inundăm
 *   rețeaua dintr-un render loop.
 *
 * Nimic din acest modul nu poate arunca — observabilitatea nu are voie să
 * spargă aplicația.
 */
import { logCrash, type CrashEntry } from "@/lib/crash-log";
import { APP_VERSION } from "@/lib/app-version";
import { performanceSettings } from "@/lib/runtime-settings";

let installed = false;
const recent = new Map<string, number>();
const DEDUPE_MS = 30_000;

function shouldSend(signature: string): boolean {
  const now = Date.now();
  const last = recent.get(signature);
  if (last && now - last < DEDUPE_MS) return false;
  recent.set(signature, now);
  if (recent.size > 100) recent.clear();
  return true;
}

function platform(): string {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("native-app")) {
    return "android";
  }
  return "web";
}

async function sendRemote(entry: CrashEntry) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    // Tabela e opțională; dacă lipsește, ignorăm liniștit eroarea.
    await (supabase as unknown as {
      from: (t: string) => {
        insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
    })
      .from("client_errors")
      .insert({
        user_id: data.user?.id ?? null,
        kind: entry.kind,
        message: entry.message.slice(0, 500),
        stack: entry.stack?.slice(0, 4000) ?? null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        boundary: entry.boundary ?? null,
        app_version: APP_VERSION,
        platform: platform(),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
      });
  } catch {
    /* observabilitatea nu blochează nimic */
  }
}

export function reportError(
  error: unknown,
  meta: { kind?: CrashEntry["kind"]; boundary?: string } = {},
) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const entry = {
      kind: meta.kind ?? "manual",
      message: err.message || "unknown error",
      stack: err.stack,
      boundary: meta.boundary,
    } as const;
    logCrash(entry);
    const signature = `${entry.kind}:${entry.boundary ?? ""}:${entry.message}`;
    if (shouldSend(signature)) {
      void sendRemote({ ...entry, ts: new Date().toISOString() } as CrashEntry);
    }
  } catch {
    /* niciodată nu aruncăm de aici */
  }
}

export function initCrashReporting() {
  if (installed || typeof window === "undefined") return;
  // Kill-switch administrabil din /admin → Setări & Flags.
  if (!performanceSettings().crash_reporting_enabled) return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportError((event as ErrorEvent).error ?? (event as ErrorEvent).message, { kind: "error" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportError((event as PromiseRejectionEvent).reason, { kind: "unhandledrejection" });
  });
}
