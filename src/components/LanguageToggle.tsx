import { useTranslation } from "react-i18next";
import { useRouterState } from "@tanstack/react-router";
import { setLanguage } from "@/lib/i18n";

/**
 * Compact global language toggle mounted in the root layout.
 * Hidden on the landing page (which has its own switcher) and on the
 * onboarding flow (`/n`) where the top-right corner is used for step controls.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Landing has its own switcher; avoid duplicating.
  if (pathname === "/" || pathname === "") return null;

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
