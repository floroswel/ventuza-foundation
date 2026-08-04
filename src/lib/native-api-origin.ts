/**
 * În build-ul nativ (Capacitor Android) aplicația rulează dintr-un bundle local
 * (`https://localhost`). Server functions TanStack (`/_serverFn/...`) și rutele
 * `/api/...` sunt relative — pe device ele lovesc WebView-ul local și pică cu
 * „Failed to fetch”.
 *
 * Patch-uim `fetch` o singură dată, cât mai devreme, ca orice cerere către
 * `/_serverFn` sau `/api/` să fie rescrisă către originul de producție.
 * Token-ul Supabase e atașat de middleware-ul existent, deci nu avem nevoie
 * de cookie-uri cross-origin.
 */

const PROD_ORIGIN = "https://suzeta.app";

const REWRITE_PREFIXES = ["/_serverFn", "/api/"];

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

function shouldRewrite(url: URL): boolean {
  if (url.origin === PROD_ORIGIN) return false;
  if (url.origin !== window.location.origin) return false;
  return REWRITE_PREFIXES.some((p) => url.pathname.startsWith(p));
}

let patched = false;

export function installNativeApiOrigin(): void {
  if (patched || !isNative()) return;
  patched = true;

  // Marker sincron, instalat înainte de primul render. Permite ca toate
  // ajustările de WebView să rămână strict în bundle-ul Capacitor, fără să
  // schimbe scroll-ul sau gesturile versiunii web.
  document.documentElement.classList.add("native-app");

  const original = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const url = new URL(raw, window.location.href);
      if (shouldRewrite(url)) {
        const target = `${PROD_ORIGIN}${url.pathname}${url.search}`;
        if (typeof input === "string" || input instanceof URL) {
          return original(target, init);
        }
        return original(new Request(target, input), init);
      }
    } catch {
      /* URL invalid — lăsăm fetch-ul original */
    }
    return original(input as RequestInfo, init);
  }) as typeof window.fetch;
}
