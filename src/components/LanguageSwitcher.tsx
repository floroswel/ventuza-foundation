import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Loader2 } from "lucide-react";
import { setLanguage } from "@/lib/i18n";
import { toast } from "sonner";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = (i18n.language || "ro").startsWith("en") ? "en" : "ro";
  const [busy, setBusy] = useState<"ro" | "en" | null>(null);

  const change = async (lng: "ro" | "en") => {
    if (lng === current) return;
    setBusy(lng);
    try {
      await setLanguage(lng);
      toast.success(lng === "ro" ? "Interfața este acum în română." : "UI is now in English.");
    } catch {
      /* i18n applied client-side even if profile persist fails */
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
              ? "Se aplică imediat. Profilul tău e tradus automat pentru cei care folosesc altă limbă."
              : "Applies instantly. Your profile is auto-translated for viewers using another language."}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["ro", "en"] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => void change(lng)}
            disabled={busy !== null}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              current === lng
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-muted-foreground hover:text-foreground"
            } disabled:opacity-60`}
          >
            {busy === lng && <Loader2 className="size-3.5 animate-spin" />}
            {t(`language.${lng}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
