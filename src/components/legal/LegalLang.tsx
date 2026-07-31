import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setLanguage } from "@/lib/i18n";

export type LegalLang = "ro" | "en";

/**
 * Limba curentă pentru paginile legale. Inițializată din i18n, dar poate fi
 * schimbată local din bara de limbă (schimbarea se propagă și global).
 */
export function useLegalLang(): [LegalLang, (l: LegalLang) => void] {
  const { i18n } = useTranslation();
  const initial: LegalLang = (i18n.resolvedLanguage || i18n.language || "en").startsWith("ro")
    ? "ro"
    : "en";
  const [lang, setLang] = useState<LegalLang>(initial);
  return [
    lang,
    (l: LegalLang) => {
      setLang(l);
      void setLanguage(l);
    },
  ];
}

/** Header comun pentru paginile legale, cu titlu bilingv și comutator RO/EN. */
export function LegalHeader({
  lang,
  onLang,
  ro,
  en,
}: {
  lang: LegalLang;
  onLang: (l: LegalLang) => void;
  ro: string;
  en: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
      <Link
        to="/settings"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
        aria-label={lang === "ro" ? "Înapoi" : "Back"}
      >
        <ChevronLeft className="size-4" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
        {lang === "ro" ? ro : en}
      </h1>
      <div
        className="inline-flex shrink-0 rounded-full border border-border/70 bg-surface/80 p-0.5 text-[10px]"
        role="group"
        aria-label="Language"
      >
        {(["ro", "en"] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => onLang(lng)}
            className={`rounded-full px-2.5 py-1 uppercase tracking-wider transition-colors ${
              lang === lng
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={lang === lng}
          >
            {lng}
          </button>
        ))}
      </div>
    </header>
  );
}
