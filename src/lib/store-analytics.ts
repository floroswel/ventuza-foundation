/**
 * Măsurarea funnel-ului web → instalare Google Play.
 *
 * Nu trimitem niciun identificator de user, IP sau device. Doar: tipul
 * evenimentului, sursa (butonul/bannerul care a fost apăsat), pagina și
 * platforma. Citirea agregată e disponibilă doar staff-ului (admin).
 */

import { supabase } from "@/integrations/supabase/client";

export type StoreFunnelKind = "store_click" | "app_open_intent" | "install_first_open";

/** Sursele posibile de click — folosite și ca `utm_source` în linkul de Play. */
export type StoreClickSource =
  | "hero_cta"
  | "smart_banner"
  | "footer"
  | "profile_share"
  | "native_first_open";

export const UTM_MEDIUM = "web_app";
export const UTM_CAMPAIGN = "install_funnel";

function platformLabel(): string {
  if (typeof navigator === "undefined") return "ssr";
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "desktop";
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
  },
): void {
  try {
    const payload = {
      _kind: kind,
      _source: opts?.source ?? null,
      _medium: UTM_MEDIUM,
      _campaign: UTM_CAMPAIGN,
      _path:
        opts?.path ??
        (typeof window !== "undefined" ? window.location.pathname : null),
      _platform: platformLabel(),
      _app_installed: opts?.appInstalled ?? null,
    };
    void supabase.rpc("log_store_funnel_event", payload as never).then(
      () => undefined,
      () => undefined,
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
