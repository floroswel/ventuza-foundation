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
  /** prima deschidere după instalare a aterizat pe pagina cerută din web (deferred deep link) */
  | "deferred_deeplink_open"
  | "install_first_open";

/** Sursele posibile de click — folosite și ca `utm_source` în linkul de store. */
export type StoreClickSource =
  | "hero_cta"
  | "smart_banner"
  | "footer"
  | "profile_share"
  | "native_first_open"
  | "web_click"
  | "install_referrer"
  | "app_link";

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
    /** Cheie de idempotență: același eveniment nu se contorizează de două ori. */
    dedupeKey?: string | null;
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
      _dedupe_key: opts?.dedupeKey ?? null,
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

/* ------------------------------------------------------------------ *
 * Idempotency: conversiile (install_first_open, app_link_open) nu se
 * dublează nici la retry-uri de rețea, nici la remount / dublu-click,
 * nici la relansarea aplicației. Trei straturi:
 *   1. gardă în memorie (același tick / remount),
 *   2. gardă persistentă în localStorage (relansare, refresh),
 *   3. cheie unică server-side (`dedupe_key`) — sursa de adevăr.
 * ------------------------------------------------------------------ */

const INSTALL_ID_KEY = "suzeta.install_id.v1";
const DEDUPE_STORE_KEY = "suzeta.funnel_dedupe.v1";
const DEDUPE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 zile

const memoryDedupe = new Set<string>();

/** ID aleator per instalare (nu identifică userul, dispare la dezinstalare). */
export function installId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.localStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(INSTALL_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function readDedupeStore(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(DEDUPE_STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const cutoff = Date.now() - DEDUPE_TTL_MS;
    const fresh: Record<string, number> = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (typeof ts === "number" && ts > cutoff) fresh[k] = ts;
    }
    return fresh;
  } catch {
    return {};
  }
}

function markDedupe(key: string, store: Record<string, number>): void {
  store[key] = Date.now();
  try {
    window.localStorage.setItem(DEDUPE_STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage plin / blocat — rămâne garda de memorie + cea din DB */
  }
}

/**
 * Trimite un eveniment o singură dată pentru cheia dată.
 * Returnează `true` dacă evenimentul a fost trimis acum, `false` dacă era deja
 * contorizat.
 */
export function trackStoreFunnelOnce(
  kind: StoreFunnelKind,
  dedupeKey: string,
  opts?: Parameters<typeof trackStoreFunnel>[1],
): boolean {
  if (typeof window === "undefined") return false;
  const key = `${kind}:${dedupeKey}`;
  if (memoryDedupe.has(key)) return false;
  const store = readDedupeStore();
  if (store[key]) {
    memoryDedupe.add(key);
    return false;
  }
  memoryDedupe.add(key);
  markDedupe(key, store);
  trackStoreFunnel(kind, { ...opts, dedupeKey: key.slice(0, 120) });
  return true;
}

const FIRST_OPEN_KEY = "suzeta.install_first_open.v1";

/**
 * Marchează conversia de instalare: prima deschidere a aplicației native.
 * O singură dată per instalare — garantat și server-side prin `dedupe_key`.
 */
export function trackNativeFirstOpen(): void {
  if (typeof window === "undefined") return;
  try {
    // compatibilitate cu flagul vechi (instalări existente)
    if (window.localStorage.getItem(FIRST_OPEN_KEY)) return;
  } catch {
    return;
  }
  const sent = trackStoreFunnelOnce("install_first_open", installId(), {
    source: "native_first_open",
  });
  if (!sent) return;
  try {
    window.localStorage.setItem(FIRST_OPEN_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

/**
 * Deschidere prin App Link / Universal Link. Se contorizează o singură dată
 * per (instalare, cale, fereastră de 30s) — protejează împotriva dublei
 * declanșări din `appUrlOpen` + fallback-ul web.
 */
export function trackAppLinkOpen(
  path: string,
  opts?: Parameters<typeof trackStoreFunnel>[1],
): boolean {
  const bucket = Math.floor(Date.now() / 30_000);
  return trackStoreFunnelOnce(
    "app_link_open",
    `${installId()}:${path}:${bucket}`,
    { ...opts, path },
  );
}

