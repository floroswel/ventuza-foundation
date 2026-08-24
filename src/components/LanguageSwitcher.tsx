import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { APP_LANGUAGES, setLanguage, normalizeLanguage, type AppLanguage } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [busy, setBusy] = useState<AppLanguage | null>(null);

  const change = async (lng: AppLanguage) => {
    if (lng === current) return;
    setBusy(lng);
    try {
      await setLanguage(lng);
      toast.success(
        lng === "ro" ? "Interfața este acum în română." : `Language set to ${lng.toUpperCase()}.`,
      );
    } catch {
      /* i18n se aplică oricum local, chiar dacă salvarea în profil eșuează */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Languages className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">{t("language.title")}</p>
          <p className="text-xs text-muted-foreground">
            {current === "ro"
              ? "Se aplică imediat. Textele netraduse apar în engleză, iar profilul tău e tradus automat pentru cine folosește altă limbă."
              : "Applies instantly. Untranslated strings fall back to English, and your profile is auto-translated for viewers using another language."}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {APP_LANGUAGES.map((lang) => {
          const active = current === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => void change(lang.code)}
              disabled={busy !== null}
              aria-pressed={active}
              className={`inline-flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:text-foreground"
              } disabled:opacity-60`}
            >
              <span className="flex items-center gap-2 truncate">
                <span aria-hidden>{lang.flag}</span>
                <span className="truncate">{lang.nativeName}</span>
              </span>
              {busy === lang.code ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : active ? (
                <Check className="size-3.5 shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {current === "ro"
          ? "Limbile marcate ca parțiale acoperă ecranele de cont, notificări, cookies și landing; restul apare în engleză până la traducerea completă."
          : "Partial languages cover account, notification, cookie and landing screens; the rest shows in English until fully translated."}
      </p>
    </div>
  );
}
