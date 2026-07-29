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
 * Această regulă este oglindită pe server în gate-urile SECURITY DEFINER
 * (`assert_age_verified` / `assert_account_usable`) și documentată în
 * MOBILE.md + AGENTS.md.
 *
 * TODO[age-gate]: Când reactivezi flag-ul în admin → șterge banner-ul de
 * avertizare din `src/routes/admin.tsx` (caută "AGE-GATE WARNING BANNER").
 */
import { supabase } from "@/integrations/supabase/client";

/** True dacă rulăm pe un host considerat PRODUCȚIE. */
export function isProductionHost(
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
): boolean {
  if (!hostname) return true; // SSR / unknown → assume prod (fail-safe)
  const h = hostname.toLowerCase();
  // Excepții dev/preview cunoscute
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return false;
  if (h.startsWith("id-preview--")) return false; // Lovable in-editor preview
  if (h.endsWith("-dev.lovable.app")) return false; // Lovable preview stable URL
  if (h.endsWith("--dev.lovable.app")) return false;
  if (h.endsWith(".lovableproject.com")) return false; // Lovable sandbox preview (editor iframe)
  if (h.endsWith(".lovable.dev")) return false; // Lovable dev preview
  // Orice altceva = PROD. Exemple recunoscute ca PROD:
  //   suzeta.eu, www.suzeta.eu (custom domain),
  //   ventuza-foundation.lovable.app (Lovable published URL).
  return true;
}

let _cache: { value: boolean; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * Returnează `true` dacă AgeGate trebuie să blocheze efectiv user-ul.
 *
 * REGULĂ — AGE GATE (AGENTS.md): în PRODUCȚIE enforcement-ul e FORȚAT ON
 * indiferent de `feature_flags.age_verification`. Flag-ul rămâne doar
 * kill-switch pentru dev/preview. Producția nu poate fi dezactivată.
 *
 * Fail-safe: dacă flag-ul lipsește sau citirea eșuează → enforcement ON.
 */
export async function shouldEnforceAgeGate(): Promise<boolean> {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.value;

  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled, segment")
      .eq("key", "age_verification")
      .maybeSingle();

    // Kill-switch explicit (temporar) pentru producție: DOAR când admin
    // setează `segment.production_kill_switch = true` ȘI `enabled = false`.
    // Folosit când providerul extern (Didit) e indisponibil. Trebuie
    // reactivat imediat ce Didit revine online.
    const segment = (data?.segment ?? null) as { production_kill_switch?: boolean } | null;
    const killSwitch = segment?.production_kill_switch === true && data?.enabled === false;

    if (isProductionHost() && !killSwitch) {
      _cache = { value: true, at: now };
      return true;
    }

    // În dev/preview SAU cu kill-switch activ → respectă flag-ul.
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
