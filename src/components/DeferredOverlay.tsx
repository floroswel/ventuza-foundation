import { Suspense, useEffect, useState, type ReactNode } from "react";

/**
 * Randează un overlay non-critic (banner, prompt) doar după hidratare și
 * doar când chunk-ul lui lazy a ajuns. Ține componentele condiționale în
 * afara bundle-ului de pornire, fără mismatch de hidratare.
 *
 * NU folosi pentru porți de siguranță/conformitate (AgeGate, PinLockGate,
 * CountryRiskGuard, SessionGuards) — acelea trebuie să fie în primul cadru.
 */
export function DeferredOverlay({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!mounted) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}
