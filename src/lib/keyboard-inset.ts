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

/**
 * A treia sursă, independentă de Capacitor și de insets: `visualViewport`.
 * Când tastatura urcă, viewportul vizual se micșorează față de cel de layout.
 * Funcționează și pe web, și în WebView, deci acoperă cazul în care nici pluginul
 * nici insetul IME nu raportează nimic.
 */
export function keyboardHeightFromViewport(m: {
  innerHeight: number;
  viewportHeight: number;
  offsetTop?: number;
}): number {
  const offsetTop = m.offsetTop ?? 0;
  if (!Number.isFinite(m.innerHeight) || !Number.isFinite(m.viewportHeight)) return 0;
  if (!Number.isFinite(offsetTop)) return 0;
  const height = m.innerHeight - m.viewportHeight - offsetTop;
  // Sub prag e zgomot: bare de browser care apar/dispar, rotunjiri de densitate.
  return height > KEYBOARD_OPEN_THRESHOLD_PX ? Math.round(height) : 0;
}

/**
 * Urmărește `visualViewport` și publică rezultatul în `--visual-keyboard-height`,
 * plus evenimentul pe care chatul îl folosește pentru reancorare. Întoarce
 * funcția de dezabonare.
 */
export function installViewportKeyboardTracking(): () => void {
  if (typeof window === "undefined") return () => {};
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  let last = -1;
  const apply = () => {
    document.documentElement.style.setProperty("--visual-viewport-height", `${Math.round(viewport.height)}px`);
    const px = keyboardHeightFromViewport({
      innerHeight: window.innerHeight,
      viewportHeight: viewport.height,
      offsetTop: viewport.offsetTop,
    });
    if (px === last) return; // `scroll` se declanșează des; nu emitem redundant
    last = px;
    document.documentElement.style.setProperty("--visual-keyboard-height", `${px}px`);
    try {
      window.dispatchEvent(new CustomEvent("suzeta:keyboard", { detail: { height: px } }));
    } catch {
      /* compensarea CSS rămâne activă și fără eveniment */
    }
  };
  apply();
  viewport.addEventListener("resize", apply);
  viewport.addEventListener("scroll", apply);
  return () => {
    viewport.removeEventListener("resize", apply);
    viewport.removeEventListener("scroll", apply);
    document.documentElement.style.removeProperty("--visual-viewport-height");
  };
}

/**
 * Sursa UNICĂ de geometrie pentru ecranul de chat.
 *
 * Pe Android, în funcție de build/WebView, tastatura poate:
 *  - redimensiona fereastra (`resizeOnFullScreen`) → `innerHeight` scade;
 *  - NU redimensiona nimic (edge-to-edge, API 30+) → doar `visualViewport` scade.
 *
 * Nu putem alege una singură, dar nici să le însumăm. Luăm minimul dintre cele
 * două: este exact spațiul rămas deasupra tastaturii, indiferent care mecanism
 * a raportat. Rezultatul ajunge în `--app-vh` (+ `--app-vt` pentru derulările
 * viewportului vizual pe web), iar shell-ul de chat este `position: fixed` pe
 * aceste valori — deci nicio compensare suplimentară din padding.
 */
export function installAppViewportTracking(): () => void {
  if (typeof window === "undefined") return () => {};
  const root = document.documentElement;
  let raf = 0;
  const apply = () => {
    raf = 0;
    const vv = window.visualViewport;
    const inner = window.innerHeight || 0;
    const visual = vv?.height ?? inner;
    const height = Math.max(0, Math.round(Math.min(inner || visual, visual || inner)));
    const offset = Math.max(0, Math.round(vv?.offsetTop ?? 0));
    root.style.setProperty("--app-vh", `${height}px`);
    root.style.setProperty("--app-vt", `${offset}px`);
  };
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(apply);
  };
  apply();
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("suzeta:keyboard", schedule as EventListener);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.removeEventListener("suzeta:keyboard", schedule as EventListener);
    window.visualViewport?.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("scroll", schedule);
    root.style.removeProperty("--app-vh");
    root.style.removeProperty("--app-vt");
  };
}
