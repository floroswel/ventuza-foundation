/**
 * AGE-GATE POLICY — feature-flag aware + hard production override.
 *
 * Regulă de business critică (dating app, minori + conținut adult):
 *   - În DEV/PREVIEW (localhost, id-preview--*.lovable.app, *--dev.lovable.app)
 *     putem dezactiva age gate-ul prin `feature_flags.age_verification.enabled=false`
 *     pentru viteză de dezvoltare.
 *   - În PRODUCȚIE (host publicat, custom domain) age gate-ul este FORȚAT ON
 *     indiferent de flag. Nu există switch care să-l oprească pe live.
 *
 * Această regulă este oglindită pe server în `requireAgeGateEnforcement`
 * (src/lib/age-verification.functions.ts) și documentată în
 * MOBILE.md + AGENTS.md.
 *
 * TODO[age-gate]: Când reactivezi flag-ul în admin → șterge banner-ul de
 * avertizare din `src/routes/admin.tsx` (caută "AGE-GATE WARNING BANNER").
 */
import { supabase } from "@/integrations/supabase/client";

/** True dacă rulăm pe un host considerat PRODUCȚIE. */
export function isProductionHost(hostname = typeof window !== "undefined" ? window.location.hostname : ""): boolean {
  if (!hostname) return true; // SSR / unknown → assume prod (fail-safe)
  const h = hostname.toLowerCase();
  // Excepții dev/preview cunoscute
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return false;
  if (h.startsWith("id-preview--")) return false;        // Lovable in-editor preview
  if (h.endsWith("-dev.lovable.app")) return false;      // Lovable preview stable URL
  if (h.endsWith("--dev.lovable.app")) return false;
  if (h.endsWith(".lovableproject.com")) return false;   // Lovable sandbox preview (editor iframe)
  if (h.endsWith(".lovable.dev")) return false;          // Lovable dev preview
  // Orice altceva (custom domain, *.lovable.app publicat) = PROD
  return true;
}

let _cache: { value: boolean; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * Returnează `true` dacă AgeGate trebuie să blocheze efectiv user-ul.
 *
 * ⚠️ KILL-SWITCH TEMPORAR ACTIV (cerut explicit de owner):
 * Override-ul hard de producție este DEZACTIVAT momentan. Atât în preview cât
 * și în producție, enforcement-ul respectă `feature_flags.age_verification.enabled`.
 * Pentru reactivare la publicarea finală: toggle flag-ul pe ON din admin
 * SAU re-introdu `if (isProductionHost()) return true;` la începutul funcției.
 *
 * Fail-safe: dacă flag-ul lipsește sau citirea eșuează → enforcement ON.
 */
export async function shouldEnforceAgeGate(): Promise<boolean> {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.value;

  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "age_verification")
      .maybeSingle();
    // Lipsește flag-ul / eroare → fail-safe ON
    const enforce = error || !data ? true : data.enabled !== false;
    _cache = { value: enforce, at: now };
    return enforce;
  } catch {
    return true;
  }
}

/** Invalidează cache-ul (apelat de admin după toggle). */
export function clearAgeGatePolicyCache() {
  _cache = null;
}
