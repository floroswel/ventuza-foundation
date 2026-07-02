import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";

export const Route = createFileRoute("/legal/business-terms")({
  head: () => ({
    meta: [
      { title: "Termeni B2B advertiseri — Ventuza" },
      {
        name: "description",
        content:
          "Contract, facturare TVA, drept de retragere și SAL pentru advertiseri pe Ventuza.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Termeni advertiseri (B2B)</h1>
      </header>

      <LegalDocOverride
        slug="business-terms"
        fallback={
          <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
            <p className="text-xs text-muted-foreground">Ultima actualizare: 22 iunie 2026</p>

            <h2 className="mt-6 text-base font-semibold">1. Operator</h2>
            <p className="mt-2 text-foreground/85">
              <strong>Ventuza</strong> — platformă de socializare LGBTQ+. Date de identificare
              fiscală vor fi completate la înregistrarea SRL. Contact comercial:{" "}
              <a className="text-primary" href="mailto:business@ventuza.app">
                business@ventuza.app
              </a>
              .
            </p>

            <h2 className="mt-6 text-base font-semibold">2. Servicii oferite</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
              <li>Bannere sponsorizate în feed-ul Discover și pagina Events.</li>
              <li>Evenimente promovate (Pride, party-uri, bar nights).</li>
              <li>
                Targeting pe oraș, vârstă și interese — fără folosirea datelor Art. 9 GDPR
                (sănătate, orientare individuală).
              </li>
            </ul>

            <h2 className="mt-6 text-base font-semibold">3. Tarife și facturare</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
              <li>
                Tarife afișate în EUR/CPM (cost per 1000 afișări), comunicate în propunerea
                comercială.
              </li>
              <li>Plată în avans, prin transfer bancar sau Stripe Business.</li>
              <li>
                Facturare cu TVA 19% (sau reverse-charge intra-UE pentru clienți cu cod VIES valid).
              </li>
              <li>Factura electronică emisă în 5 zile lucrătoare de la încasare.</li>
            </ul>

            <h2 className="mt-6 text-base font-semibold">4. Drept de retragere (14 zile)</h2>
            <p className="mt-2 text-foreground/85">
              Conform OUG 34/2014, pentru contractele la distanță cu profesioniști{" "}
              <strong>nu se aplică</strong> dreptul de retragere de 14 zile (relație B2B). Pentru
              clienți persoane fizice (rar), retragerea este posibilă{" "}
              <em>până la activarea campaniei</em>; după lansare serviciul este considerat executat
              integral.
            </p>

            <h2 className="mt-6 text-base font-semibold">5. Moderare conținut</h2>
            <p className="mt-2 text-foreground/85">
              Refuzăm reclame care: discriminează LGBTQ+, promovează terapii de conversie, conțin
              nuditate explicită, vând substanțe ilegale, încalcă DSA sau drepturi de autor. Decizia
              este finală și banii sunt rambursați integral dacă reclama nu trece moderarea.
            </p>

            <h2 className="mt-6 text-base font-semibold">6. Reclamații și SAL</h2>
            <p className="mt-2 text-foreground/85">
              Reclamații:{" "}
              <a className="text-primary" href="mailto:business@ventuza.app">
                business@ventuza.app
              </a>{" "}
              (răspuns în 10 zile). Litigii neformalizate pot fi adresate ANPC (
              <a className="text-primary" href="https://anpc.ro" target="_blank" rel="noreferrer">
                anpc.ro
              </a>
              ) sau prin platforma SOL a Comisiei Europene:{" "}
              <a
                className="text-primary"
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noreferrer"
              >
                ec.europa.eu/consumers/odr
              </a>
              .
            </p>

            <h2 className="mt-6 text-base font-semibold">7. Lege aplicabilă</h2>
            <p className="mt-2 text-foreground/85">
              Contractul este guvernat de legea română. Instanța competentă: judecătoria de la
              sediul Ventuza.
            </p>
          </article>
        }
      />
    </div>
  );
}
