/**
 * Country gate — consumă `useCountryRisk` (ipapi.co + `get_country_risk`) și
 * expune boolean-uri stabile pentru enforcement în UI/logică.
 *
 * REGULĂ DE SIGURANȚĂ:
 * - Detectarea eșuată (IP nerezolvat, ofline, ipapi down) => TOATE gate-urile
 *   întorc `false`. Nu blocăm useri legitimi din cauza unei detecții ratate.
 * - Nu stocăm istoricul locației (doar cache TTL 15 min din useCountryRisk).
 * - Nu trimitem coordonatele userului la server pentru asta.
 *
 * Nivele de risc (mapate din country_risk_config):
 *   normal   → nimic
 *   elevated → banner discret + link /safety (funcțional normal)
 *   high     → stealth forțat + locație și mai vagă / discover ascuns opțional
 *   blocked  → redirect /blocked-region, fără signup/login
 */
import { useCountryRisk, type CountryRisk } from "@/hooks/useCountryRisk";

export type CountryGate = {
  loading: boolean;
  country: string | null;
  risk: CountryRisk;
  isBlocked: boolean;
  isDiscoverDisabled: boolean;
  forceStealth: boolean;
  hidePreciseLocation: boolean;
  isElevated: boolean;
};

export function useCountryGate(): CountryGate {
  const { loading, country, risk } = useCountryRisk();
  return {
    loading,
    country,
    risk,
    // Fail-graceful: risk===null (detecție eșuată) => toate false.
    isBlocked: risk?.disable_signup === true,
    isDiscoverDisabled: risk?.disable_discover === true,
    forceStealth: risk?.force_stealth === true,
    hidePreciseLocation: risk?.hide_precise_location === true,
    isElevated: risk?.risk_level === "elevated",
  };
}

/** Paths whitelisted chiar și pentru useri din țări blocate (pagini publice). */
const BLOCKED_ALLOW_PREFIXES = [
  "/blocked-region",
  "/legal",
  "/account-deletion",
  "/safety",
];

export function isPathAllowedWhenBlocked(pathname: string): boolean {
  return BLOCKED_ALLOW_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}
