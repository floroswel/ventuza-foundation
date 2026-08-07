/**
 * Diagnostic TEMPORAR pentru scroll (doar development).
 *
 * Tot fișierul este inert în release: `installScrollDiagnostics()` iese imediat
 * dacă `import.meta.env.DEV` este false, iar Vite înlocuiește constanta cu
 * `false` la build, deci corpul funcției este eliminat de tree-shaking și NU
 * ajunge în bundle-ul AAB.
 *
 * Folosire în dev (consolă, inclusiv prin chrome://inspect pe device):
 *   __suzetaScrollDiag()      → raport pentru ultimul punct atins
 *   __suzetaScrollDiag(x, y)  → raport pentru un punct explicit
 *
 * Nu raportează text, date de profil sau valori de input — doar geometrie de
 * layout și identificatori de element (tag, id, clase).
 */

type ElementInfo = {
  tag: string;
  id: string | null;
  classes: string;
  overflowY: string;
  scrollHeight: number;
  clientHeight: number;
  scrollable: boolean;
};

type ScrollReport = {
  path: string;
  innerHeight: number;
  visualViewportHeight: number | null;
  documentScrollHeight: number;
  bodyScrollHeight: number;
  scrollY: number;
  htmlOverflowY: string;
  bodyOverflowY: string;
  htmlOverflowX: string;
  bodyOverflowX: string;
  htmlTouchAction: string;
  bodyTouchAction: string;
  safeAreaTop: string;
  safeAreaBottom: string;
  keyboardHeight: string;
  documentCanScroll: boolean;
  /** true dacă body e scroll container fără extent — cauza clasică de pan mort. */
  bodyIsInertScroller: boolean;
  point: { x: number; y: number } | null;
  elementAtPoint: ElementInfo | null;
  nearestScrollContainer: ElementInfo | null;
  ancestorChain: ElementInfo[];
};

function describe(el: Element): ElementInfo {
  const cs = getComputedStyle(el);
  const scrollHeight = (el as HTMLElement).scrollHeight;
  const clientHeight = (el as HTMLElement).clientHeight;
  const overflowY = cs.overflowY;
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    // Clasele sunt utilitare Tailwind — fără conținut de utilizator.
    classes: (el.getAttribute("class") ?? "").slice(0, 160),
    overflowY,
    scrollHeight,
    clientHeight,
    scrollable:
      (overflowY === "auto" || overflowY === "scroll") && scrollHeight > clientHeight + 1,
  };
}

let lastPoint: { x: number; y: number } | null = null;

export function installScrollDiagnostics(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const w = window as unknown as { __suzetaScrollDiag?: unknown };
  if (w.__suzetaScrollDiag) return;

  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (t) lastPoint = { x: Math.round(t.clientX), y: Math.round(t.clientY) };
    },
    { passive: true },
  );

  w.__suzetaScrollDiag = (x?: number, y?: number): ScrollReport => {
    const html = document.documentElement;
    const body = document.body;
    const htmlCs = getComputedStyle(html);
    const bodyCs = getComputedStyle(body);
    const rootCs = htmlCs;

    const point =
      typeof x === "number" && typeof y === "number"
        ? { x, y }
        : (lastPoint ?? { x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2) });

    const at = document.elementFromPoint(point.x, point.y);
    const chain: ElementInfo[] = [];
    let nearest: ElementInfo | null = null;
    for (let el: Element | null = at; el; el = el.parentElement) {
      const info = describe(el);
      chain.push(info);
      if (!nearest && info.scrollable) nearest = info;
      if (el === html) break;
    }

    const bodyOverflowY = bodyCs.overflowY;
    return {
      path: location.pathname,
      innerHeight,
      visualViewportHeight: window.visualViewport?.height ?? null,
      documentScrollHeight: html.scrollHeight,
      bodyScrollHeight: body.scrollHeight,
      scrollY,
      htmlOverflowY: htmlCs.overflowY,
      bodyOverflowY,
      htmlOverflowX: htmlCs.overflowX,
      bodyOverflowX: bodyCs.overflowX,
      htmlTouchAction: htmlCs.touchAction,
      bodyTouchAction: bodyCs.touchAction,
      safeAreaTop: rootCs.getPropertyValue("--safe-top").trim() || "(nedefinit)",
      safeAreaBottom: rootCs.getPropertyValue("--safe-bottom").trim() || "(nedefinit)",
      keyboardHeight: rootCs.getPropertyValue("--keyboard-height").trim() || "(nedefinit)",
      documentCanScroll: html.scrollHeight > innerHeight + 1,
      bodyIsInertScroller:
        (bodyOverflowY === "auto" || bodyOverflowY === "scroll") &&
        body.scrollHeight <= body.clientHeight + 1,
      point,
      elementAtPoint: at ? describe(at) : null,
      nearestScrollContainer: nearest,
      ancestorChain: chain.slice(0, 12),
    };
  };
}
