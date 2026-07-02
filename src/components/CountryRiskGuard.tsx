import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { useCountryGate, isPathAllowedWhenBlocked } from "@/lib/country-gate";

/**
 * Guard vizibil montat în root. Două responsabilități:
 * 1. Blocked regions (disable_signup) → redirect la /blocked-region.
 * 2. Elevated (Turcia etc.) → banner discret cu link la /safety.
 *
 * Nivelele high (force_stealth, hide_precise_location, disable_discover) sunt
 * enforced în locurile care contează:
 *   - SessionGuards (nu publică coordonate când forceStealth=true)
 *   - proximity-watcher (bail când hide_precise_location sau forceStealth)
 *   - /discover route (early-return când disable_discover)
 *   - /auth (refuză signup/login când isBlocked)
 *
 * Fail-graceful: dacă detectarea eșuează, `useCountryGate` întoarce toate
 * flag-urile pe `false`; guard-ul nu face nimic.
 */
export function CountryRiskGuard() {
  const { loading, isBlocked, isElevated, forceStealth, isDiscoverDisabled } = useCountryGate();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissedElevated, setDismissedElevated] = useState(false);
  const [dismissedStealth, setDismissedStealth] = useState(false);

  useEffect(() => {
    if (loading || !isBlocked) return;
    const path = location.pathname || "/";
    if (isPathAllowedWhenBlocked(path)) return;
    navigate({ to: "/blocked-region", replace: true });
  }, [loading, isBlocked, location.pathname, navigate]);

  if (loading || isBlocked) return null;

  return (
    <>
      {isElevated && !dismissedElevated ? (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 flex items-center gap-3 border-b border-border/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 backdrop-blur"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">
            Meeting people in your region carries extra risk. Read our{" "}
            <a href="/safety" className="underline underline-offset-2">
              safety tips
            </a>
            .
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded p-1 hover:bg-white/10"
            onClick={() => setDismissedElevated(true)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
      {(forceStealth || isDiscoverDisabled) && !dismissedStealth ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-md rounded-md border border-border/60 bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur"
        >
          <div className="flex items-start gap-2">
            <span className="flex-1">
              Reduced mode is active for your safety. Some features (public discovery, precise
              location, proximity alerts) are disabled in your region.
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded p-1 hover:bg-white/10"
              onClick={() => setDismissedStealth(true)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
