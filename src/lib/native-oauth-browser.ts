// Plan B pentru Google Sign-In în build-ul nativ (Google Play).
//
// De ce: Credential Manager (SDK-ul nativ) poate returna USER_CANCELLED când
// device-ul nu are credential eligibil sau când SHA-1-ul nu se potrivește cu
// clientul OAuth Android. Fluxul de mai jos NU depinde de clientul Android:
// deschide pagina publică suzeta.app/auth în Chrome Custom Tabs (browser de
// sistem, acceptat de Google — spre deosebire de WebView) și primește sesiunea
// înapoi printr-un deep link `app.suzeta://auth-callback#access_token=...`.

import { supabase } from "@/integrations/supabase/client";

const PROD_ORIGIN = "https://suzeta.app";
export const NATIVE_BRIDGE_SCHEME = "app.suzeta";
export const NATIVE_BRIDGE_CALLBACK = `${NATIVE_BRIDGE_SCHEME}://auth-callback`;

export type BrowserOAuthResult =
  | { ok: true }
  | { ok: false; code: "unsupported" | "cancelled" | "error"; message?: string };

function parseTokens(url: string): { access_token: string; refresh_token: string } | null {
  try {
    const parsed = new URL(url);
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const params = new URLSearchParams(hash || parsed.search.replace(/^\?/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return null;
    return { access_token, refresh_token };
  } catch {
    return null;
  }
}

/**
 * Deschide fluxul OAuth în browserul de sistem și așteaptă deep link-ul de
 * întoarcere. Rezolvă doar după ce sesiunea Supabase a fost setată.
 */
export async function browserGoogleSignIn(timeoutMs = 180_000): Promise<BrowserOAuthResult> {
  let App: typeof import("@capacitor/app").App;
  let Browser: typeof import("@capacitor/browser").Browser;
  try {
    ({ App } = await import("@capacitor/app"));
    ({ Browser } = await import("@capacitor/browser"));
  } catch {
    return { ok: false, code: "unsupported", message: "Capacitor plugins indisponibile" };
  }

  const url = `${PROD_ORIGIN}/auth?native_bridge=1&mode=login`;

  return new Promise<BrowserOAuthResult>((resolve) => {
    let settled = false;
    let urlListener: { remove: () => void } | null = null;
    let closeListener: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = async (result: BrowserOAuthResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { urlListener?.remove(); } catch { /* ignore */ }
      try { closeListener?.remove(); } catch { /* ignore */ }
      try { await Browser.close(); } catch { /* ignore */ }
      resolve(result);
    };

    void (async () => {
      urlListener = await App.addListener("appUrlOpen", ({ url: incoming }) => {
        if (!incoming?.startsWith(NATIVE_BRIDGE_CALLBACK)) return;
        const tokens = parseTokens(incoming);
        if (!tokens) {
          void finish({ ok: false, code: "error", message: "Deep link fără tokeni" });
          return;
        }
        void (async () => {
          const { error } = await supabase.auth.setSession(tokens);
          if (error) {
            await finish({ ok: false, code: "error", message: error.message });
            return;
          }
          await finish({ ok: true });
        })();
      });

      closeListener = await Browser.addListener("browserFinished", () => {
        // Utilizatorul a închis Custom Tab-ul fără să termine fluxul.
        setTimeout(() => {
          if (!settled) void finish({ ok: false, code: "cancelled", message: "Fereastra a fost închisă" });
        }, 1200);
      });

      timer = setTimeout(() => {
        void finish({ ok: false, code: "cancelled", message: "Timeout autentificare" });
      }, timeoutMs);

      try {
        await Browser.open({ url, presentationStyle: "popover", windowName: "_self" });
      } catch (error) {
        await finish({
          ok: false,
          code: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });
}
