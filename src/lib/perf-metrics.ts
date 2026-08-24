/**
 * Instrumentare de pornire: TTFR (time to first render) și TTI (time to
 * interactive) măsurate pe device real, nu doar în laborator.
 *
 * - `markFirstRender()` — apelat la primul commit React din root.
 * - `markInteractive(reason)` — apelat când primul ecran util e gata
 *   (sesiune rezolvată + primele date randate) sau, ca plasă de siguranță,
 *   după ce browserul devine idle.
 *
 * Valorile se logează în consolă (vizibile în logcat pe Android) și se trimit
 * în `public.web_vitals` cu aceleași metrici ca web-vitals standard, ca să
 * putem compara device-uri reale. Trimiterea e best-effort și nu blochează
 * niciodată UI-ul.
 */

type Phase = "first_render" | "interactive" | "boot_data";

const marks = new Map<Phase, number>();
let reported = new Set<Phase>();

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/** Timp scurs de la începutul navigării (timeOrigin), în ms. */
export function sinceBoot(): number {
  return Math.round(now());
}

async function report(phase: Phase, value: number) {
  if (reported.has(phase)) return;
  reported.add(phase);

  const label = `[perf] ${phase}=${value}ms`;
  // Vizibil în DevTools și în logcat (WebView → console).
  console.info(label);

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    await supabase.from("web_vitals").insert({
      user_id: data.user?.id ?? null,
      metric: `app_${phase}`,
      value,
      rating: value < 1500 ? "good" : value < 3500 ? "needs-improvement" : "poor",
      path: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 200),
      app_version: (await import("@/lib/app-version")).APP_VERSION,
      platform: document.documentElement.classList.contains("native-app") ? "android" : "web",
    });
  } catch {
    /* metricile nu trebuie să spargă nimic */
  }
}

function mark(phase: Phase) {
  if (typeof window === "undefined" || marks.has(phase)) return;
  const value = sinceBoot();
  marks.set(phase, value);
  // Raportăm după ce firul principal se eliberează.
  const send = () => void report(phase, value);
  if (typeof requestIdleCallback === "function") requestIdleCallback(send, { timeout: 4000 });
  else setTimeout(send, 1200);
}

export function markFirstRender() {
  mark("first_render");
}

export function markBootDataReady() {
  mark("boot_data");
}

export function markInteractive() {
  mark("interactive");
}

/** Plasă de siguranță: dacă nimic nu a marcat TTI în 8s, o facem noi. */
export function scheduleInteractiveFallback() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => markInteractive(), 8000);
}

/** Snapshot pentru panouri de debug. */
export function perfSnapshot(): Record<string, number> {
  return Object.fromEntries(marks);
}

/** Doar pentru teste. */
export function __resetPerfMarks() {
  marks.clear();
  reported = new Set();
}
