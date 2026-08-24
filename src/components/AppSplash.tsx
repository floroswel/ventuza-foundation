import { useEffect, useState } from "react";
import { SUZETA_ICON_URL } from "@/lib/brand-assets";

/**
 * Animație de deschidere: logo-ul apare din centru, „respiră" (scale 0.9 → 1)
 * și se topește în aplicație. Rulează o singură dată per lansare de aplicație
 * (sessionStorage), ca navigarea internă să nu o reafișeze.
 *
 * Durată totală ~0.64s: 420ms puls + 220ms fade-out (era 1.2s).
 */
const SEEN_KEY = "suzeta_splash_shown";

export function AppSplash() {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocat → arătăm animația */
    }
    if (seen) return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }

    // Respectăm preferința de sistem pentru mișcare redusă.
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setMounted(true);
    const fadeAt = window.setTimeout(() => setLeaving(true), reduce ? 150 : 420);
    const doneAt = window.setTimeout(() => setMounted(false), reduce ? 320 : 640);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(doneAt);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-300 ease-out"
      style={{ opacity: leaving ? 0 : 1, pointerEvents: leaving ? "none" : "auto" }}
    >
      <div className="splash-logo">
        <img
          src={SUZETA_ICON_URL}
          alt=""
          width={112}
          height={112}
          className="h-28 w-28 rounded-3xl"
          decoding="async"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
