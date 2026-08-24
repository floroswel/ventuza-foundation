/**
 * Test A/B pe CTA-ul de instalare: „Get it on Google Play” (control) vs
 * „Deschide în aplicație” (variantă). Alocarea e stabilă per device
 * (localStorage), 50/50, și se trimite pe fiecare eveniment de funnel ca să
 * putem compara ratele de conversie pe variantă în panoul admin.
 */

export type InstallCtaVariant = "play_badge" | "open_app";

const KEY = "suzeta.install_cta_variant.v1";

export function getInstallCtaVariant(): InstallCtaVariant {
  if (typeof window === "undefined") return "play_badge";
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "play_badge" || saved === "open_app") return saved;
    const pick: InstallCtaVariant = Math.random() < 0.5 ? "play_badge" : "open_app";
    window.localStorage.setItem(KEY, pick);
    return pick;
  } catch {
    return "play_badge";
  }
}

/** Textul CTA-ului în funcție de variantă și de starea de instalare. */
export function installCtaLabel(
  variant: InstallCtaVariant,
  appInstalled: boolean | null,
): string {
  if (appInstalled) return "Deschide în aplicație";
  return variant === "open_app" ? "Deschide în aplicație" : "Get it on Google Play";
}

/** Variantă scurtă, pentru bannerul sticky. */
export function installCtaShortLabel(
  variant: InstallCtaVariant,
  appInstalled: boolean | null,
): string {
  if (appInstalled) return "Deschide";
  return variant === "open_app" ? "Deschide" : "Instalează";
}
