/**
 * Deferred deep linking: pagina țintă + parametrii UTM supraviețuiesc
 * instalării din magazin.
 *
 * Flux:
 *  1. Web (suzeta.ro / suzeta.app) — la click pe „Descarcă”, salvăm calea
 *     dorită + UTM-urile în `localStorage` ȘI le codificăm în `referrer`-ul
 *     Google Play (`dl=/path`), pe care Play îl livrează aplicației prin
 *     Install Referrer după instalare.
 *  2. Nativ — la primul boot, `resolveDeferredDeepLink()` citește (în ordine)
 *     Install Referrer (dacă pluginul nativ e disponibil) și apoi fallback-ul
 *     din storage, apoi navighează o singură dată către calea respectivă cu
 *     UTM-urile atașate în query.
 *
 * Confidențialitate: nu stocăm identificatori de user/device — doar calea din
 * app și parametrii de campanie (utm_*). Vezi `store-analytics.ts`.
 */

const PENDING_KEY = "suzeta.deferred_deeplink.v1";
const CONSUMED_KEY = "suzeta.deferred_deeplink.done.v1";
/** După 7 zile o intenție de instalare nu mai e relevantă. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DeferredLink = {
  /** Calea internă (începe cu „/”), fără origin. */
  path: string;
  /** Parametrii de campanie păstrați ca atare. */
  utm: Record<string, string>;
  /** Timestamp ISO al salvării. */
  at: string;
  /** Sursa deducerii: click web sau Install Referrer de la Google Play. */
  origin: "web_click" | "install_referrer" | "app_link";
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "ref",
] as const;

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Normalizează o cale internă („/nearby?x=1”), refuzând URL-uri externe. */
export function sanitizeDeepLinkPath(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim();
  if (!value) return null;
  try {
    if (/^https?:\/\//i.test(value)) {
      const u = new URL(value);
      value = `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    return null;
  }
  if (!value.startsWith("/")) value = `/${value}`;
  // Blocăm „//host” (protocol-relative) și backslash-urile.
  if (value.startsWith("//") || value.includes("\\")) return null;
  if (value === "/") return null;
  return value.slice(0, 300);
}

/** Extrage parametrii de campanie din URL-ul curent (sau dintr-un query dat). */
export function readUtmParams(search?: string): Record<string, string> {
  const raw =
    search ?? (typeof window !== "undefined" ? window.location.search : "") ?? "";
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v) out[key] = v.slice(0, 120);
  }
  return out;
}

/** Atașează UTM-urile la o cale internă, fără să suprascrie ce există deja. */
export function withUtm(path: string, utm: Record<string, string>): string {
  if (!Object.keys(utm).length) return path;
  const [base, hash = ""] = path.split("#");
  const [pathname, query = ""] = (base ?? "/").split("?");
  const params = new URLSearchParams(query);
  for (const [k, v] of Object.entries(utm)) if (!params.has(k)) params.set(k, v);
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Salvează intenția de deep link înainte de a trimite userul în magazin. */
export function stashDeferredDeepLink(
  path: string,
  utm: Record<string, string>,
  origin: DeferredLink["origin"] = "web_click",
): void {
  const clean = sanitizeDeepLinkPath(path);
  if (!clean) return;
  const store = safeStorage();
  if (!store) return;
  const payload: DeferredLink = { path: clean, utm, at: new Date().toISOString(), origin };
  try {
    store.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch {
    /* storage plin / blocat — degradare tăcută */
  }
}

function readStashed(): DeferredLink | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeferredLink;
    const path = sanitizeDeepLinkPath(parsed?.path);
    if (!path) return null;
    if (Date.now() - new Date(parsed.at).getTime() > TTL_MS) return null;
    return { ...parsed, path, utm: parsed.utm ?? {} };
  } catch {
    return null;
  }
}

function clearStashed(): void {
  try {
    safeStorage()?.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

type InstallReferrerPlugin = { getReferrer?: () => Promise<{ referrer?: string } | string> };

/**
 * Install Referrer (Google Play). Dacă build-ul nativ include un plugin
 * `InstallReferrer`, îl folosim; altfel întoarcem null și rămâne fallback-ul
 * din storage. Nu adăugăm dependențe obligatorii pentru web.
 */
async function readInstallReferrer(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } })
    .Capacitor;
  const plugin = cap?.Plugins?.["InstallReferrer"] as InstallReferrerPlugin | undefined;
  if (!plugin?.getReferrer) return null;
  try {
    const res = await plugin.getReferrer();
    const value = typeof res === "string" ? res : res?.referrer;
    return value ? String(value) : null;
  } catch {
    return null;
  }
}

/** Transformă un referrer Play („utm_source=..&dl=%2Fnearby”) într-un DeferredLink. */
export function parseReferrer(referrer: string): DeferredLink | null {
  if (!referrer) return null;
  // Play poate întoarce referrer-ul dublu-encodat.
  let raw = referrer;
  if (!raw.includes("=") && raw.includes("%3D")) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* păstrăm forma originală */
    }
  }
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const path = sanitizeDeepLinkPath(params.get("dl"));
  const utm = readUtmParams(params.toString());
  if (!path && !Object.keys(utm).length) return null;
  return {
    path: path ?? "/",
    utm,
    at: new Date().toISOString(),
    origin: "install_referrer",
  };
}

/**
 * Rezolvă o singură dată (per instalare) destinația amânată.
 * Ordinea: Install Referrer (atribuire reală Play) → stash local.
 */
export async function resolveDeferredDeepLink(): Promise<DeferredLink | null> {
  const store = safeStorage();
  if (store?.getItem(CONSUMED_KEY)) return null;

  const referrer = await readInstallReferrer();
  const fromReferrer = referrer ? parseReferrer(referrer) : null;
  const link = fromReferrer?.path && fromReferrer.path !== "/" ? fromReferrer : readStashed();

  try {
    store?.setItem(CONSUMED_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
  clearStashed();

  if (!link) return null;
  const path = sanitizeDeepLinkPath(link.path);
  if (!path) return null;
  return { ...link, path };
}

/** Calea finală de navigat, cu UTM-urile păstrate în query. */
export function deferredTarget(link: DeferredLink): string {
  return withUtm(link.path, link.utm);
}
