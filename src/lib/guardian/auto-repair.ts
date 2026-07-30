/**
 * Guardian — auto-reparare SIGURĂ (client).
 *
 * Execută DOAR acțiuni reversibile, cu risc mic, decise de `core.decide()`.
 * Orice acțiune cu impact pe plăți, abonamente, RLS, permisiuni admin,
 * schema DB, ștergeri de date, autentificare, secrete, termeni legali sau
 * moderare este INTERZISĂ aici — acelea devin acțiuni „pending approval".
 */
import type { GuardianPlan } from "./core";

const COOLDOWN_MS = 30_000;
const lastRun = new Map<string, number>();

function throttled(key: string): boolean {
  const now = Date.now();
  const prev = lastRun.get(key) ?? 0;
  if (now - prev < COOLDOWN_MS) return true;
  lastRun.set(key, now);
  return false;
}

export type RepairResult = { ok: boolean; action: string; detail?: string };

export async function runAutoRepair(plan: GuardianPlan): Promise<RepairResult> {
  if (!plan.autoSafe || !plan.reversible || plan.risk !== "low") {
    return { ok: false, action: plan.action, detail: "blocked_unsafe" };
  }
  if (throttled(plan.action)) return { ok: false, action: plan.action, detail: "throttled" };

  try {
    switch (plan.action) {
      case "refresh_session": {
        const { supabase } = await import("@/integrations/supabase/client");
        const { error } = await supabase.auth.refreshSession();
        return { ok: !error, action: plan.action, detail: error?.message };
      }
      case "reconnect_realtime": {
        const { supabase } = await import("@/integrations/supabase/client");
        try {
          supabase.realtime.disconnect();
        } catch {
          /* noop */
        }
        supabase.realtime.connect();
        return { ok: true, action: plan.action };
      }
      case "clear_cache": {
        const { recoverFromStaleChunk } = await import("@/lib/chunk-recovery");
        await recoverFromStaleChunk();
        return { ok: true, action: plan.action };
      }
      case "use_cached_data": {
        // marcăm modul degradat; UI-ul citește din cache-ul TanStack Query
        try {
          sessionStorage.setItem("suzeta_guardian_degraded", String(Date.now()));
        } catch {
          /* noop */
        }
        window.dispatchEvent(new CustomEvent("suzeta:guardian-degraded"));
        return { ok: true, action: plan.action };
      }
      case "reload_images": {
        document.querySelectorAll<HTMLImageElement>("img[data-guardian-retry!='1']").forEach((img) => {
          if (img.complete && img.naturalWidth > 0) return;
          img.dataset.guardianRetry = "1";
          const src = img.src;
          img.src = "";
          img.src = src;
        });
        return { ok: true, action: plan.action };
      }
      case "safe_route": {
        if (window.location.pathname !== "/") window.location.assign("/");
        return { ok: true, action: plan.action };
      }
      case "reload_app": {
        window.location.reload();
        return { ok: true, action: plan.action };
      }
      case "retry":
      default:
        // retry-ul propriu-zis e făcut de TanStack Query / message-outbox;
        // aici doar semnalizăm ca să se reia cererile în așteptare.
        window.dispatchEvent(new CustomEvent("suzeta:guardian-retry"));
        return { ok: true, action: plan.action };
    }
  } catch (e) {
    return { ok: false, action: plan.action, detail: (e as Error)?.message };
  }
}

/** Retry cu backoff exponențial pentru orice operație idempotentă. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseMs ?? 300;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, base * 2 ** i + Math.random() * 100));
    }
  }
  throw lastErr;
}
