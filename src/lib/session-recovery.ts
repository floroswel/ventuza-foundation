// Recuperarea sesiunii pe nativ (Android/iOS) după un update de aplicație.
//
// Context: sesiunea Supabase este scrisă în localStorage (WebView) ȘI în
// Capacitor Preferences (SharedPreferences). La un update din Google Play,
// WebView-ul își poate pierde localStorage-ul, iar bridge-ul nativ răspunde
// lent la primul cold start. Dacă `getSession()` întoarce `null` în acel
// moment, userul apare deconectat deși refresh tokenul e valid.
//
// Această funcție citește copia autoritară din Preferences și o reinjectează
// în client. Este idempotentă: nu șterge nimic, doar copiază înapoi în
// storage-ul rapid și cere clientului să adopte sesiunea.

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type StoredSession = {
  access_token?: string;
  refresh_token?: string;
};

function parseStored(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession & { currentSession?: StoredSession };
    // supabase-js v2 stochează obiectul sesiunii direct; v1 îl împacheta.
    const session = parsed.currentSession ?? parsed;
    if (session?.access_token && session?.refresh_token) return session;
    return null;
  } catch {
    return null;
  }
}

function projectRef(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  const match = /https?:\/\/([^.]+)\./.exec(url);
  return match?.[1] ?? null;
}

/**
 * Încearcă o singură dată să restaureze sesiunea din stocarea nativă.
 * Întoarce sesiunea restaurată sau `null` dacă nu există copie locală validă.
 * Nu șterge niciodată date și nu deloghează userul.
 */
export async function recoverNativeSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (!cap?.isNativePlatform?.()) return null;

    const { Preferences } = await import("@capacitor/preferences");
    const ref = projectRef();
    const candidates = new Set<string>();
    if (ref) candidates.add(`sb-${ref}-auth-token`);
    try {
      const { keys } = await Preferences.keys();
      for (const k of keys) {
        if (k.startsWith("sb-") && k.includes("auth-token")) candidates.add(k);
      }
    } catch {
      /* keys() poate lipsi pe implementări vechi — folosim doar cheia derivată */
    }

    for (const key of candidates) {
      const { value } = await Preferences.get({ key });
      const stored = parseStored(value);
      if (!stored) continue;
      // Repunem copia în storage-ul rapid ca următoarele citiri să fie instant.
      try {
        window.localStorage.setItem(key, value as string);
      } catch {
        /* ignore */
      }
      const { data, error } = await supabase.auth.setSession({
        access_token: stored.access_token as string,
        refresh_token: stored.refresh_token as string,
      });
      if (!error && data.session) return data.session;
    }
    return null;
  } catch {
    return null;
  }
}
