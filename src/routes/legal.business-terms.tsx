import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";
import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";

export const Route = createFileRoute("/legal/business-terms")({
  head: () => ({
    meta: [
      { title: "Termeni B2B advertiseri — Suzeta" },
      {
        name: "description",
        content:
          "Contract, facturare TVA, drept de retragere și SAL pentru advertiseri și parteneri pe Suzeta.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-dvh bg-background">
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
            <p className="text-xs text-muted-foreground">Ultima actualizare: 5 iulie 2026</p>

            <h2 className="mt-6 text-base font-semibold">1. Prestator / Operator</h2>
            <p className="mt-2 text-foreground/85">
              Serviciile B2B (banner-e, evenimente promovate, portal partener) sunt prestate de{" "}
              <strong>{OPERATOR.legalName}</strong>, operatorul aplicației{" "}
              <strong>{OPERATOR.brand}</strong>.
            </p>
            <div className="mt-3">
              <OperatorIdentificationBlock includeIban />
            </div>
            <p className="mt-3 text-foreground/85">
              Contact comercial:{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.business}`}>
                {OPERATOR.emails.business}
              </a>
              .
            </p>

            <h2 className="mt-6 text-base font-semibold">2. Servicii oferite</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
              <li>Bannere sponsorizate în feed-ul Discover și pagina Events.</li>
              <li>Evenimente promovate (Pride, party-uri, bar nights).</li>
              <li>
                Portal Partener (venues / events / oferte) cu abonamente lunare, moderare umană a
                fiecărei publicări și entitlements diferențiate pe plan.
              </li>
              <li>
                Targeting pe oraș, vârstă și interese — fără folosirea datelor Art. 9 GDPR
                (sănătate, orientare individuală).
              </li>
            </ul>

            <h2 className="mt-6 text-base font-semibold">3. Tarife și facturare</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
              <li>
                Tarifele curente sunt gestionate central în{" "}
                <code>app_settings.billing_settings</code> și comunicate prin propunerea comercială
                / portalul partener. Prețurile sunt afișate în RON, cu TVA 19% inclus pentru
                clienți români și reverse-charge intra-UE pentru clienți cu cod VIES valid.
              </li>
              <li>
                Plată prin transfer bancar (ordin de plată) în contul emitentului:
                <div className="mt-1 rounded-md border border-border bg-surface/40 px-3 py-2 font-mono text-[12px]">
                  Beneficiar: {OPERATOR.legalName}
                  <br />
                  IBAN: {OPERATOR.iban}
                  <br />
                  Banca: {OPERATOR.bank}
                  <br />
                  CUI: {OPERATOR.cui} · Reg. Com.: {OPERATOR.regCom}
                </div>
              </li>
              <li>
                Numerotarea facturilor este alocată automat, atomic, per serie și an, prin funcția
                internă <code>public.next_invoice_number</code> (reset anual, zero salturi).
              </li>
              <li>
                Factura electronică (PDF + XML e-Factura, unde este cazul) este emisă în maximum 5
                zile lucrătoare de la încasare și trimisă pe emailul de facturare declarat.
              </li>
              <li>
                Neplată: retrogradare automată la planul Free după perioada de grație configurată,
                fără ștergerea conținutului. Reactivarea la plată se face de un moderator, cu
                intrare în auditul intern.
              </li>
            </ul>

            <h2 className="mt-6 text-base font-semibold">4. Drept de retragere</h2>
            <p className="mt-2 text-foreground/85">
              <strong>B2B:</strong> conform OUG 34/2014 privind drepturile consumatorilor, pentru
              contractele la distanță cu profesioniști (relații B2B) <strong>nu se aplică</strong>{" "}
              dreptul de retragere de 14 zile.
            </p>
            <p className="mt-2 text-foreground/85">
              <strong>Persoane fizice (rar, ex. sponsor eveniment individual):</strong> ai drept
              de retragere 14 zile calendaristice de la încheierea contractului, prin notificare
              scrisă la{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.business}`}>
                {OPERATOR.emails.business}
              </a>
              . Dacă serviciul a fost deja activat integral cu acordul tău expres (ex. campania a
              fost lansată), pierzi dreptul de retragere pentru partea executată (Art. 16 lit. a
              OUG 34/2014).
            </p>

            <h2 className="mt-6 text-base font-semibold">5. Moderare conținut</h2>
            <p className="mt-2 text-foreground/85">
              Refuzăm reclame care: discriminează LGBTQ+, promovează terapii de conversie, conțin
              nuditate explicită, vând substanțe ilegale, încalcă DSA sau drepturi de autor.
              Decizia este finală și sumele deja plătite sunt rambursate integral dacă reclama nu
              trece moderarea.
            </p>

            <h2 className="mt-6 text-base font-semibold">
              6. Reclamații, ANPC și soluționarea alternativă a litigiilor (SAL)
            </h2>
            <p className="mt-2 text-foreground/85">
              Reclamații către prestator:{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.business}`}>
                {OPERATOR.emails.business}
              </a>{" "}
              — răspuns în maximum 10 zile lucrătoare.
            </p>
            <p className="mt-2 text-foreground/85">
              Consumatorii persoane fizice pot solicita soluționarea alternativă a litigiilor
              (SAL) conform OG 38/2015. Autoritatea națională competentă:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
              <li>
                <strong>ANPC — Autoritatea Națională pentru Protecția Consumatorilor</strong>:{" "}
                <a className="text-primary" href="https://anpc.ro" target="_blank" rel="noreferrer">
                  anpc.ro
                </a>{" "}
                (formular reclamații:{" "}
                <a
                  className="text-primary"
                  href="https://anpc.ro/ce-este-sal/"
                  target="_blank"
                  rel="noreferrer"
                >
                  anpc.ro/ce-este-sal/
                </a>
                ).
              </li>
              <li>
                <strong>Platforma UE SOL (Soluționare Online Litigii)</strong>:{" "}
                <a
                  className="text-primary"
                  href="https://ec.europa.eu/consumers/odr"
                  target="_blank"
                  rel="noreferrer"
                >
                  ec.europa.eu/consumers/odr
                </a>
                .
              </li>
            </ul>
            <p className="mt-2 text-foreground/85">
              Adresa de email pentru comunicarea cu ANPC / SAL:{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.business}`}>
                {OPERATOR.emails.business}
              </a>
              .
            </p>

            <h2 className="mt-6 text-base font-semibold">7. Lege aplicabilă și jurisdicție</h2>
            <p className="mt-2 text-foreground/85">
              Contractul este guvernat de legea română. Instanța competentă: instanțele de la
              sediul social al prestatorului ({OPERATOR.address}), sub rezerva drepturilor
              consumatorului conform legislației române și UE.
            </p>
          </article>
        }
      />
    </div>
  );
}
