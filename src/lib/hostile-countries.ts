/**
 * Țări unde relațiile same-sex sunt criminalizate (ILGA World 2024).
 * Sursă unică — folosită de `TravelWarning` (locația reală) și de selectorul
 * de locație Explorer (locația aleasă manual). Nu duplica lista.
 */
export const HOSTILE_COUNTRIES = new Set([
  "AF", "DZ", "BD", "BN", "BI", "CM", "TD", "KM", "CG", "EG", "ER", "ET",
  "GM", "GH", "GN", "GW", "GY", "IR", "IQ", "JM", "KE", "KW", "LB", "LR",
  "LY", "MW", "MY", "MV", "MR", "MA", "MM", "NA", "NG", "OM", "PK", "PS",
  "QA", "SA", "SN", "SL", "SO", "SS", "ST", "LK", "SD", "SY", "TZ", "TG",
  "TN", "TM", "UG", "AE", "UZ", "YE", "ZM", "ZW",
]);

export function isHostileCountry(code?: string | null): boolean {
  return !!code && HOSTILE_COUNTRIES.has(code.toUpperCase());
}
