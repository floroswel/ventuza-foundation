// Citire sincronă a sesiunii deja salvate pe device.
//
// La pornire, `supabase.auth.getSession()` poate dura secunde (bridge nativ,
// rotație de token, rețea proastă). Dacă avem deja o sesiune validă scrisă în
// localStorage, o folosim imediat ca să afișăm aplicația fără așteptare;
// clientul Supabase o va valida și reîmprospăta în fundal.

import type { Session } from "@supabase/supabase-js";

function isSessionKey(k: string) {
  return k.startsWith("sb-") && k.includes("auth-token");
}

/** Sesiunea din storage-ul rapid, dacă access_token-ul nu a expirat încă. */
export function readCachedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!isSessionKey(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      const obj = parsed as { currentSession?: Session } & Session;
      const session = (obj?.currentSession ?? obj) as Session | undefined;
      if (!session?.access_token || !session?.refresh_token || !session?.user) continue;
      const expiresAt = (session.expires_at ?? 0) * 1000;
      // Marjă de 60s: dacă tokenul e aproape expirat, lăsăm bootstrap-ul normal
      // să facă refresh înainte de a afișa ecrane care fac cereri autentificate.
      if (expiresAt && expiresAt - Date.now() < 60_000) continue;
      return session;
    }
  } catch {
    /* storage blocat → fără fast path */
  }
  return null;
}
