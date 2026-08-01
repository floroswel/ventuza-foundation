// Native Google Sign-In pentru wrapper-ul Android (Capacitor).
//
// De ce: pe Google Play (WebView) fluxul `lovable.auth.signInWithOAuth("google")`
// deschide pagina Google în WebView, iar Google returnează 404 pentru
// WebView-uri (blocare oficială din 2021). Ca soluție nativă folosim
// `@capgo/capacitor-social-login` care apelează Google Sign-In SDK direct →
// primim un `idToken` → îl schimbăm în sesiune Supabase prin
// `supabase.auth.signInWithIdToken`.
//
// Web-ul continuă să folosească fluxul managed `lovable.auth.signInWithOAuth`.

import { supabase } from "@/integrations/supabase/client";

let initialized = false;

export async function isNativeAndroid(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let cachedClientId: string | null = null;
let clientIdProbe: Promise<string | null> | null = null;

function webClientIdSync(): string | null {
  // Build-time env (opțional). Sursa primară e secretul server-side
  // GOOGLE_OAUTH_CLIENT_ID, citit prin `getGoogleWebClientId`.
  const id = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ?? "";
  return id.trim() ? id.trim() : cachedClientId;
}

/**
 * Origin de producție folosit ca fallback în build-ul nativ, unde aplicația
 * rulează de pe `capacitor://localhost` și rutele relative nu există.
 */
const PROD_ORIGIN = "https://suzeta.app";

async function fetchClientIdFromNetwork(): Promise<string | null> {
  // 1) Nativ (sau orice context fără server fn relativ): endpoint public absolut.
  if (await isNativePlatform()) {
    try {
      const res = await fetch(`${PROD_ORIGIN}/api/public/google-client-id`);
      if (res.ok) {
        const json = (await res.json()) as { clientId?: string | null };
        if (json?.clientId) return json.clientId;
      }
    } catch { /* ignore, cădem pe server fn */ }
  }
  // 2) Web: server fn (același origin).
  try {
    const { getGoogleWebClientId } = await import("@/lib/google-config.functions");
    const r = await getGoogleWebClientId();
    return r?.clientId ?? null;
  } catch {
    return null;
  }
}

/** Rezolvă Client ID-ul: env build-time → cache → secret server-side. */
export async function resolveWebClientId(): Promise<string | null> {
  const local = webClientIdSync();
  if (local) return local;
  if (!clientIdProbe) {
    clientIdProbe = fetchClientIdFromNetwork()
      .then((id) => {
        cachedClientId = id;
        return cachedClientId;
      })
      .catch(() => null);
  }
  return clientIdProbe;
}

export function hasNativeGoogleConfig(): boolean {
  return webClientIdSync() !== null;
}

export async function hasNativeGoogleConfigAsync(): Promise<boolean> {
  return (await resolveWebClientId()) !== null;
}

export async function nativeGoogleSupported(): Promise<boolean> {
  if (!(await resolveWebClientId())) return false;
  return isNativeAndroid();
}



async function ensureInit(clientId: string): Promise<void> {
  if (initialized) return;
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await SocialLogin.initialize({
    google: {
      webClientId: clientId,
      // forceCodeForRefreshToken doar dacă avem nevoie de refresh — nu în cazul
      // nostru, Supabase gestionează sesiunea după signInWithIdToken.
    },
  });
  initialized = true;
}

export type NativeGoogleResult =
  | { ok: true }
  | { ok: false; code: "unsupported" | "no_id_token" | "cancelled" | "error"; message?: string };

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  const clientId = await resolveWebClientId();
  if (!clientId) return { ok: false, code: "unsupported", message: "missing GOOGLE_OAUTH_CLIENT_ID" };

  if (!(await isNativePlatform())) return { ok: false, code: "unsupported" };

  try {
    await ensureInit(clientId);
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    const result = (await SocialLogin.login({
      provider: "google",
      options: {
        scopes: ["email", "profile", "openid"],
        forceRefreshToken: true,
      },
    })) as { result?: { idToken?: string | null } };

    const idToken = result?.result?.idToken ?? null;
    if (!idToken) return { ok: false, code: "no_id_token" };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) return { ok: false, code: "error", message: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return { ok: false, code: "cancelled", message: msg };
    return { ok: false, code: "error", message: msg };
  }
}
