// Stale-session reaper.
//
// Dacă userul a fost șters server-side (sau tokenul de refresh a fost revocat),
// clientul rămâne cu o sesiune „fantomă" în localStorage: fiecare cerere
// întoarce 403 `user_not_found` / 400 `refresh_token_not_found`, iar UI-ul se
// blochează (onboarding dă 409 pe FK, Guardian se umple de incidente).
//
// Soluția: verificăm identitatea la server; dacă userul nu mai există, curățăm
// local sesiunea și trimitem userul la /auth. Fără pași manuali.

import { supabase } from "@/integrations/supabase/client";

const STALE_CODES = new Set([
  "user_not_found",
  "refresh_token_not_found",
  "session_not_found",
  "user_banned_missing", // defensive
]);

function isStale(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; message?: string; status?: number };
  if (e.code && STALE_CODES.has(e.code)) return true;
  const m = (e.message ?? "").toLowerCase();
  return (
    m.includes("user from sub claim in jwt does not exist") ||
    m.includes("refresh token not found") ||
    m.includes("session from session_id claim in jwt does not exist")
  );
}

let purging = false;

/** Curăță sesiunea locală și duce userul la ecranul de autentificare. */
export async function purgeStaleSession(reason: string) {
  if (purging || typeof window === "undefined") return;
  purging = true;
  try {
    console.warn("[auth] sesiune invalidă, se curăță local:", reason);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
    const sessionKeys: string[] = [];
    try {
      for (const k of Object.keys(window.localStorage)) {
        if (k.startsWith("sb-") && k.includes("auth-token")) {
          sessionKeys.push(k);
          window.localStorage.removeItem(k);
        }
      }
    } catch {
      /* ignore */
    }
    // Pe nativ copia autoritară stă în Capacitor Preferences: dacă nu o ștergem,
    // sesiunea moartă se rehidratează la următoarea pornire și userul intră
    // într-un ciclu de deconectări.
    try {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor;
      if (cap?.isNativePlatform?.()) {
        const { Preferences } = await import("@capacitor/preferences");
        await Promise.all(sessionKeys.map((k) => Preferences.remove({ key: k }).catch(() => {})));
      }
    } catch {
      /* ignore */
    }
    const path = window.location.pathname;
    if (!path.startsWith("/auth") && path !== "/") {
      window.location.replace("/auth");
    } else {
      window.location.reload();
    }
  } finally {
    // lăsăm flagul setat: pagina oricum se reîncarcă
  }
}

/**
 * Verifică o singură dată identitatea la server. Întoarce `true` dacă sesiunea
 * era invalidă și a fost curățată.
 */
export async function reapStaleSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return false;
  const { error } = await supabase.auth.getUser();
  if (!isStale(error)) return false;

  // A doua opinie: la cold start (mai ales imediat după un update de aplicație)
  // o rotație concurentă de refresh token poate produce o eroare tranzitorie.
  // Nu scoatem userul din cont pe prima eroare — reîncercăm o dată.
  await new Promise((r) => setTimeout(r, 1500));
  const retry = await supabase.auth.getUser();
  if (!isStale(retry.error)) return false;

  await purgeStaleSession(String((retry.error as { code?: string })?.code ?? retry.error?.message));
  return true;
}

export { isStale as isStaleSessionError };
