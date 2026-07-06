import { useTranslation } from "react-i18next";
import { useRouterState } from "@tanstack/react-router";
import { setLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

/**
 * Compact global language toggle.
 *
 * REGULĂ STRICTĂ (nu se slăbește):
 *   Afișat DOAR pe fluxul de auth (/auth*, /reset-password) și DOAR când
 *   utilizatorul NU are sesiune activă. După logare este complet ascuns și
 *   nu răspunde la evenimente — orice cod care încearcă să-l randeze în
 *   restul aplicației trebuie să iasă din funcție înainte de JSX.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, loading } = useAuth();

  // 1) Cât timp nu știm dacă e logat, nu randăm nimic (evită flicker + hydration mismatch).
  if (loading) return null;
  // 2) Dacă există sesiune — ascuns complet, indiferent de path.
  if (session) return null;
  // 3) Doar pe rutele de auth publice.
  const isPublicAuthRoute =
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/reset-password";
  if (!isPublicAuthRoute) return null;

  const current = (i18n.resolvedLanguage || i18n.language || "en").startsWith("ro") ? "ro" : "en";

  return (
    <div
      className="fixed right-3 top-3 z-40 inline-flex rounded-full border border-border/70 bg-surface/80 p-0.5 text-[10px] shadow-sm backdrop-blur"
      role="group"
      aria-label="Language"
    >
      {(["ro", "en"] as const).map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => void setLanguage(lng)}
          className={`rounded-full px-2.5 py-1 uppercase tracking-wider transition-colors ${
            current === lng
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={current === lng}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
