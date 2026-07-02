/**
 * Pure helpers pentru derivarea stărilor unui panou admin cu date + SLA.
 * Extrase pentru a putea fi testate fără React/jsdom.
 *
 * Regulă (AGENTS.md → ADMIN PANELS):
 *  - loading vizibil, dar cu cale de ieșire pe eroare;
 *  - eroare distinctă de empty legitim;
 *  - refresh eșuat DUPĂ o încărcare reușită NU aruncă utilizatorul afară —
 *    păstrăm datele vechi și afișăm doar un banner „soft" cu retry;
 *  - eroarea la SLA (praguri) NU blochează restul panoului — banner separat.
 */

export type PanelBannerKind = "fatal" | "soft" | "warning" | null;

export type SlaPanelInputs = {
  /** Ultima eroare de la fetch-ul principal (null dacă cererea curentă a reușit). */
  error: string | null;
  /** True dacă panoul a reușit vreodată să încarce date (avem ce afișa). */
  hasLoadedOnce: boolean;
  /** Eroare separată pentru pragurile SLA. */
  slaError: string | null;
  /** True cât timp promisiunea curentă rulează. */
  loading: boolean;
  /** Numărul de rânduri returnate ultima dată (folosit pentru empty legitim). */
  rowCount: number;
};

export type SlaPanelState = {
  /** Ce banner de eroare trebuie afișat pentru fetch-ul principal (sau null). */
  primaryBanner: PanelBannerKind;
  /** Ce banner trebuie afișat pentru SLA (soft-warning). */
  slaBanner: PanelBannerKind;
  /** True doar dacă suntem în încărcare inițială (nu avem date vechi). */
  showInitialSpinner: boolean;
  /** True doar dacă cererea a reușit și a întors zero rânduri. */
  showLegitEmpty: boolean;
};

export function derivePanelState(inp: SlaPanelInputs): SlaPanelState {
  const fatal = !!inp.error && !inp.hasLoadedOnce;
  const soft = !!inp.error && inp.hasLoadedOnce;
  return {
    primaryBanner: fatal ? "fatal" : soft ? "soft" : null,
    slaBanner: inp.slaError ? "warning" : null,
    showInitialSpinner: inp.loading && !inp.hasLoadedOnce && !inp.error,
    showLegitEmpty: !inp.error && inp.hasLoadedOnce && inp.rowCount === 0,
  };
}
