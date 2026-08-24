import { performanceSettings } from "@/lib/runtime-settings";
/**
 * Preferință „Reduced Motion" controlată de utilizator, peste preferința de
 * sistem (`prefers-reduced-motion`). Setarea se aplică prin clasa
 * `.reduce-motion` pe <html>, consumată din `src/styles.css`.
 *
 * Valori: "system" (default) | "on" | "off".
 */
export type MotionPref = "system" | "on" | "off";

const KEY = "suzeta:motion-pref";
const EVENT = "suzeta:motion-pref-change";

export function getMotionPref(): MotionPref {
  if (typeof localStorage === "undefined") return "system";
  try {
    const v = localStorage.getItem(KEY);
    return v === "on" || v === "off" ? v : "system";
  } catch {
    return "system";
  }
}

export function systemPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Rezultatul efectiv: mișcarea trebuie redusă? */
export function isReducedMotion(): boolean {
  const pref = getMotionPref();
  if (pref === "on") return true;
  if (pref === "off") return false;
  if (performanceSettings().reduce_motion_default) return true;
  return systemPrefersReducedMotion();
}

export function applyMotionPref() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", isReducedMotion());
}

export function setMotionPref(pref: MotionPref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage blocat */
  }
  applyMotionPref();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}

export function onMotionPrefChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
