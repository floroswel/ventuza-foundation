import { createFileRoute } from "@tanstack/react-router";
import { BADGES, sortBadges } from "@/lib/badges-registry";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/legal/badges")({
  component: BadgesCatalog,
});

function BadgesCatalog() {
  const all = sortBadges(Object.keys(BADGES));
  const users = all.filter((b) => b.target === "user");
  const venues = all.filter((b) => b.target !== "user");

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Catalog Badge-uri Ventuza</h1>
        <p className="text-muted-foreground">
          Toate badge-urile sunt acordate automat, pe baza unor criterii publice. Nu se pot cumpăra.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Badge-uri utilizatori</h2>
        <div className="grid gap-3">
          {users.map((b) => {
            const Icon = b.icon;
            return (
              <Card key={b.code} className="p-4 flex gap-4 items-start">
                <div className="rounded-full bg-muted p-2">
                  <Icon className={`size-6 ${b.colorClass}`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{b.label.ro}</div>
                  <div className="text-sm text-muted-foreground">{b.criteria}</div>
                  {b.expiry && (
                    <div className="text-xs text-muted-foreground italic mt-1">Expirare: {b.expiry}</div>
                  )}
                </div>

              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Badge-uri parteneri &amp; locații</h2>
        <div className="grid gap-3">
          {venues.map((b) => {
            const Icon = b.icon;
            return (
              <Card key={b.code} className="p-4 flex gap-4 items-start">
                <div className="rounded-full bg-muted p-2">
                  <Icon className={`size-6 ${b.colorClass}`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{b.label.ro}</div>
                  <div className="text-sm text-muted-foreground">{b.criteria}</div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="text-xs text-muted-foreground pt-6 border-t">
        Maxim 3 badge-uri sunt afișate simultan per profil sau card. Badge-urile expiră automat când criteriile nu mai
        sunt îndeplinite (ex: boost expirat, plan downgrade-at).
      </footer>
    </div>
  );
}
