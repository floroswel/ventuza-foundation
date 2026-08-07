/**
 * Ce se întâmplă cu profilul DESCHIS după Like / Pass / Back.
 *
 * Înainte, `handleDecision` apela `setSelected(null)` necondiționat, în capul
 * funcției, pentru toate acțiunile. Așa, cele trei gesturi cu intenții complet
 * diferite ajungeau la aceeași închidere:
 *
 *   Like  → trebuie să RĂMÂNĂ pe profil (utilizatorul tocmai l-a apreciat);
 *   Pass  → trebuie să treacă la URMĂTORUL profil, fără Grid intermediar;
 *   Back  → singurul care închide și revine în Grid, pe poziția memorată.
 *
 * Modulul e pur ca să poată fi testat fără DOM, Supabase sau router.
 */

export type DecisionAction = "like" | "pass" | "super";

/** Ce trebuie să facă UI-ul cu sheet-ul de profil după decizie. */
export type SheetOutcome =
  /** Like: profilul rămâne deschis. */
  | { kind: "stay" }
  /** Pass: sări direct pe următorul profil eligibil. */
  | { kind: "advance"; next: string }
  /** Pass fără următor: abia acum se revine în Grid. */
  | { kind: "close" };

export function isLike(action: DecisionAction): boolean {
  return action === "like" || action === "super";
}

/**
 * Următorul profil eligibil după cel curent, respectând ordinea listei deja
 * filtrate de Discover (distanță, vârstă, block, hidden…). Profilurile cărora
 * li s-a dat Pass sunt sărite, ca să nu reapară imediat.
 *
 * Caută întâi înainte, apoi înapoi: la ultimul profil din listă, Pass duce la
 * cel anterior în loc să arunce utilizatorul în Grid.
 */
export function nextEligibleId(
  ordered: readonly string[],
  currentId: string,
  excluded: ReadonlySet<string> = new Set(),
): string | null {
  const at = ordered.indexOf(currentId);
  if (at === -1) return null;
  const skip = (id: string) => id === currentId || excluded.has(id);

  for (let i = at + 1; i < ordered.length; i++) {
    if (!skip(ordered[i])) return ordered[i];
  }
  for (let i = at - 1; i >= 0; i--) {
    if (!skip(ordered[i])) return ordered[i];
  }
  return null;
}

/**
 * Regula centrală. `next` se calculează pe lista de DINAINTE de eliminarea
 * profilului trecut cu Pass.
 */
export function sheetOutcomeFor(action: DecisionAction, next: string | null): SheetOutcome {
  if (isLike(action)) return { kind: "stay" };
  return next ? { kind: "advance", next } : { kind: "close" };
}

/**
 * Un tap repetat pe Like nu trebuie să producă un al doilea rând în `swipes`
 * și nici o a doua notificare la destinatar. `swipes` are unicitate
 * (swiper_id, target_id), dar oprim cererea din client ca să nu depindem de
 * cursa dintre două tap-uri rapide.
 */
export function shouldSendDecision(
  action: DecisionAction,
  previous: DecisionAction | undefined,
): boolean {
  return previous !== action;
}
