import { createFileRoute } from "@tanstack/react-router";
import { BADGES, sortBadges, type BadgeLang } from "@/lib/badges-registry";
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/legal/badges")({
  component: BadgesCatalog,
});

export function BadgesCatalog() {
  const { i18n } = useTranslation();
  const lang: BadgeLang = i18n.language?.startsWith("en") ? "en" : "ro";
  const t = (ro: string, en: string) => (lang === "ro" ? ro : en);

  const all = sortBadges(Object.keys(BADGES));
  const users = all.filter((b) => b.target === "user");
  const venues = all.filter((b) => b.target !== "user");

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">
          {t("Catalog Badge-uri Suzeta", "Suzeta Badges Catalog")}
        </h1>
        <p className="text-muted-foreground">
          {t(
            "Toate badge-urile sunt acordate automat, pe baza unor criterii publice. Nu se pot cumpăra.",
            "All badges are granted automatically based on public criteria. They cannot be purchased.",
          )}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          {t("Badge-uri utilizatori", "User badges")}
        </h2>
        <div className="grid gap-3">
          {users.map((b) => {
            const Icon = b.icon;
            return (
              <Card key={b.code} className="p-4 flex gap-4 items-start">
                <div className="rounded-full bg-muted p-2">
                  <Icon className={`size-6 ${b.colorClass}`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{b.label[lang]}</div>
                  <div className="text-sm text-muted-foreground">{b.criteria[lang]}</div>
                  {b.expiry && (
                    <div className="text-xs text-muted-foreground italic mt-1">
                      {t("Expirare:", "Expires:")} {b.expiry[lang]}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          {t("Badge-uri parteneri & locații", "Partner & venue badges")}
        </h2>
        <div className="grid gap-3">
          {venues.map((b) => {
            const Icon = b.icon;
            return (
              <Card key={b.code} className="p-4 flex gap-4 items-start">
                <div className="rounded-full bg-muted p-2">
                  <Icon className={`size-6 ${b.colorClass}`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{b.label[lang]}</div>
                  <div className="text-sm text-muted-foreground">{b.criteria[lang]}</div>
                  {b.expiry && (
                    <div className="text-xs text-muted-foreground italic mt-1">
                      {t("Expirare:", "Expires:")} {b.expiry[lang]}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="text-xs text-muted-foreground pt-6 border-t">
        {t(
          "Maxim 3 badge-uri sunt afișate simultan per profil sau card. Badge-urile expiră automat când criteriile nu mai sunt îndeplinite (ex: boost expirat, plan downgrade-at).",
          "At most 3 badges are shown at once per profile or card. Badges expire automatically when their criteria are no longer met (e.g. boost expired, plan downgraded).",
        )}
      </footer>
    </div>
  );
}
