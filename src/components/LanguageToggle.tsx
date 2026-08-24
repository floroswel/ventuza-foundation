import { useTranslation } from "react-i18next";
import { useRouterState } from "@tanstack/react-router";
import { Languages } from "lucide-react";

import { APP_LANGUAGES, setLanguage, normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

/**
 * Selector global de limbă.
 *
 * REGULĂ STRICTĂ (nu se slăbește):
 *   Afișat DOAR pe fluxul de auth (/auth*, /reset-password) și DOAR când
 *   utilizatorul NU are sesiune activă. După logare este complet ascuns —
 *   schimbarea limbii se face din Setări → Limbă.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, loading } = useAuth();

  if (loading) return null;
  if (session) return null;

  const isPublicAuthRoute =
    pathname === "/auth" || pathname.startsWith("/auth/") || pathname === "/reset-password";
  if (!isPublicAuthRoute) return null;

  const current = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div className="fixed right-3 top-3 z-40 inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface/80 px-2 py-1 text-[11px] shadow-sm backdrop-blur">
      <Languages className="size-3.5 text-muted-foreground" aria-hidden />
      <label className="sr-only" htmlFor="app-language">
        Language
      </label>
      <select
        id="app-language"
        value={current}
        onChange={(e) => void setLanguage(e.target.value as AppLanguage)}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-foreground outline-none"
      >
        {APP_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
