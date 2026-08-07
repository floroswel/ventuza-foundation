/**
 * Logica pură din spatele compensării tastaturii pe Android.
 *
 * Există două surse care raportează înălțimea tastaturii, iar niciuna nu e
 * garantată singură:
 *  - `@capacitor/keyboard` prin `keyboardWillShow`/`keyboardDidShow`;
 *  - `WindowInsetsCompat.Type.ime()`, citit în MainActivity — sursa autoritară pe
 *    API 30+, unde fereastra NU se mai redimensionează în edge-to-edge.
 *
 * Amândouă descriu ACEEAȘI tastatură, deci se combină cu `max`, niciodată prin
 * adunare: două compensări însumate ar ridica composer-ul de două ori.
 */

/** Numărul de pixeli de rezervat pentru tastatură, din oricâte surse. */
export function effectiveKeyboardHeight(...sources: Array<number | null | undefined>): number {
  let best = 0;
  for (const value of sources) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (value > best) best = value;
  }
  return best;
}

/** Peste acest prag considerăm tastatura deschisă (filtrează zgomotul de 1-2px). */
export const KEYBOARD_OPEN_THRESHOLD_PX = 24;

export function isKeyboardOpen(height: number | null | undefined): boolean {
  return typeof height === "number" && Number.isFinite(height) && height > KEYBOARD_OPEN_THRESHOLD_PX;
}

export type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

/** Distanța până la baza listei, în px. Nu poate fi negativă. */
export function distanceFromBottom(m: ScrollMetrics): number {
  return Math.max(0, m.scrollHeight - m.scrollTop - m.clientHeight);
}

/**
 * Era utilizatorul aproape de ultimul mesaj? Doar atunci ancorăm la bază când
 * apare tastatura — altfel l-am smuci din mijlocul istoricului pe care îl citea.
 */
export function isNearBottom(m: ScrollMetrics, threshold = 200): boolean {
  return distanceFromBottom(m) < threshold;
}

/** `scrollTop` care aduce ultimul mesaj exact deasupra composer-ului. */
export function bottomScrollTop(m: Pick<ScrollMetrics, "scrollHeight" | "clientHeight">): number {
  return Math.max(0, m.scrollHeight - m.clientHeight);
}
