/**
 * Parametri runtime administrabili din /admin → Setări & Flags
 * (`app_settings.performance_settings`).
 *
 * Sursa de adevăr este DB-ul; codul are DOAR fallback-uri identice cu
 * valorile seed-uite. Nu hardcoda praguri noi în componente — adaugă-le aici
 * și în cheia din `app_settings`.
 */
import { supabase } from "@/integrations/supabase/client";

export type PerformanceSettings = {
  splash_pulse_ms: number;
  splash_fade_ms: number;
  image_max_dim: number;
  image_quality: number;
  signed_url_ttl_hours: number;
  reduce_motion_default: boolean;
  crash_reporting_enabled: boolean;
  perf_sampling_rate: number;
  photo_reoptimize_enabled: boolean;
};

export const PERFORMANCE_DEFAULTS: PerformanceSettings = {
  splash_pulse_ms: 420,
  splash_fade_ms: 220,
  image_max_dim: 1440,
  image_quality: 0.8,
  signed_url_ttl_hours: 8,
  reduce_motion_default: false,
  crash_reporting_enabled: true,
  perf_sampling_rate: 1,
  photo_reoptimize_enabled: true,
};

const CACHE_KEY = "suzeta_perf_settings_v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

let cached: PerformanceSettings = PERFORMANCE_DEFAULTS;
let loaded = false;

function readLocal(): PerformanceSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: Partial<PerformanceSettings> };
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return { ...PERFORMANCE_DEFAULTS, ...parsed.value };
  } catch {
    return null;
  }
}

/** Valoare sincronă (cache local sau default). Sigur de apelat la render. */
export function performanceSettings(): PerformanceSettings {
  if (!loaded) {
    const local = readLocal();
    if (local) cached = local;
    loaded = true;
  }
  return cached;
}

/** Reîmprospătează din DB (apelat o dată la boot, non-blocant). */
export async function refreshPerformanceSettings(): Promise<PerformanceSettings> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "performance_settings")
      .maybeSingle();
    const value = (data?.value ?? null) as Partial<PerformanceSettings> | null;
    if (value && typeof value === "object") {
      cached = { ...PERFORMANCE_DEFAULTS, ...value };
      loaded = true;
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), value: cached }));
      } catch {
        /* storage plin / blocat */
      }
    }
  } catch {
    /* offline → rămân default-urile */
  }
  return cached;
}
