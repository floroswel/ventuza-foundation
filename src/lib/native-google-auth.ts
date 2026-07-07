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

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

function webClientId(): string | null {
  // Client-side env (public — audience pentru id_token). Trebuie să fie tipul
  // "Web application" din Google Cloud Console și să fie și în lista de
  // audiențe acceptate ale providerului Google din Supabase Auth.
  const id = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ?? "";
  return id.trim() ? id.trim() : null;
}

export function nativeGoogleSupported(): Promise<boolean> {
  if (!webClientId()) return Promise.resolve(false);
  return isNative();
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
  const clientId = webClientId();
  if (!clientId) return { ok: false, code: "unsupported", message: "missing VITE_GOOGLE_WEB_CLIENT_ID" };
  if (!(await isNative())) return { ok: false, code: "unsupported" };

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
