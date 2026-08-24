/**
 * Măsurarea funnel-ului web → instalare (Google Play / App Store).
 *
 * Nu trimitem niciun identificator de user, IP sau device. Doar: tipul
 * evenimentului, sursa (butonul/bannerul apăsat), varianta A/B, pagina,
 * platforma și referrer-ul UTM efectiv trimis către magazin. Citirea agregată
 * e disponibilă doar staff-ului (admin).
 */

import { supabase } from "@/integrations/supabase/client";

export type StoreFunnelKind =
  | "store_click"
  /** deschidere prin Universal Link (iOS) / Android App Link — atribuire directă */
  | "app_link_open"
  /** deschidere prin `intent://` (Android, fallback automat spre store) */
  | "intent_open"
  /** păstrat pentru compatibilitate cu evenimentele deja înregistrate */
  | "app_open_intent"
  | "install_first_open";

/** Sursele posibile de click — folosite și ca `utm_source` în linkul de store. */
export type StoreClickSource =
  | "hero_cta"
  | "smart_banner"
  | "footer"
  | "profile_share"
  | "native_first_open";

export const UTM_MEDIUM = "web_app";
export const UTM_CAMPAIGN = "install_funnel";

export function platformLabel(): string {
  if (typeof navigator === "undefined") return "ssr";
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "desktop";
}

/** Ultimul eveniment trimis — folosit de overlay-ul de debug (`?debug=funnel`). */
export type LastFunnelEvent = {
  id: number | null;
  kind: StoreFunnelKind;
  source: string | null;
  variant: string | null;
  referrer: string | null;
  platform: string;
  path: string | null;
  at: string;
  error?: string;
};

let lastEvent: LastFunnelEvent | null = null;
const listeners = new Set<(e: LastFunnelEvent) => void>();

export function getLastFunnelEvent(): LastFunnelEvent | null {
  return lastEvent;
}

export function onFunnelEvent(cb: (e: LastFunnelEvent) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function publish(e: LastFunnelEvent) {
  lastEvent = e;
  listeners.forEach((cb) => {
    try {
      cb(e);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Trimite un eveniment de funnel. Nu blochează niciodată navigarea:
 * erorile sunt înghițite intenționat (analytics best-effort).
 */
export function trackStoreFunnel(
  kind: StoreFunnelKind,
  opts?: {
    source?: StoreClickSource | string;
    path?: string;
    appInstalled?: boolean | null;
    variant?: string | null;
    referrer?: string | null;
  },
): void {
  const base: LastFunnelEvent = {
    id: null,
    kind,
    source: opts?.source ?? null,
    variant: opts?.variant ?? null,
    referrer: opts?.referrer ?? null,
    platform: platformLabel(),
    path:
      opts?.path ?? (typeof window !== "undefined" ? window.location.pathname : null),
    at: new Date().toISOString(),
  };
  publish(base);
  try {
    const payload = {
      _kind: kind,
      _source: base.source,
      _medium: UTM_MEDIUM,
      _campaign: UTM_CAMPAIGN,
      _path: base.path,
      _platform: base.platform,
      _app_installed: opts?.appInstalled ?? null,
      _variant: base.variant,
      _referrer: base.referrer,
    };
    void supabase.rpc("log_store_funnel_event", payload as never).then(
      (res: { data?: unknown; error?: { message: string } | null }) => {
        if (res?.error) {
          publish({ ...base, error: res.error.message });
          return;
        }
        const id = typeof res?.data === "number" ? res.data : Number(res?.data ?? NaN);
        publish({ ...base, id: Number.isFinite(id) ? id : null });
      },
      (e: unknown) => publish({ ...base, error: e instanceof Error ? e.message : String(e) }),
    );
  } catch {
    /* best-effort */
  }
}

const FIRST_OPEN_KEY = "suzeta.install_first_open.v1";

/**
 * Marchează conversia de instalare: prima deschidere a aplicației native.
 * Rulează o singură dată per instalare (flag în localStorage, șters la
 * dezinstalare împreună cu datele aplicației).
 */
export function trackNativeFirstOpen(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(FIRST_OPEN_KEY)) return;
    window.localStorage.setItem(FIRST_OPEN_KEY, new Date().toISOString());
  } catch {
    return;
  }
  trackStoreFunnel("install_first_open", { source: "native_first_open" });
}
