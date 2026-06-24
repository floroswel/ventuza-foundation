import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { setLanguage } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = (i18n.language || "ro").startsWith("en") ? "en" : "ro";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Languages className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">{t("language.title")}</p>
          <p className="text-xs text-muted-foreground">{t("language.auto")}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["ro", "en"] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => setLanguage(lng)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              current === lng
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`language.${lng}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
