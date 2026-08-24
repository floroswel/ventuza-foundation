import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";

export const Route = createFileRoute("/legal/wallet-terms")({
  head: () => ({
    meta: [
      { title: "Regulament Portofel și program ambasador — Suzeta" },
      {
        name: "description",
        content:
          "Regulile programului de recomandări Suzeta: cum acumulezi credit, cum comanzi produse, dreptul de retragere de 14 zile și cum reclami.",
      },
      { property: "og:title", content: "Regulament Portofel Suzeta" },
      {
        property: "og:description",
        content:
          "Credit din recomandări, comenzi merch, drept de retragere 14 zile, garanții și reclamații ANPC.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/legal/wallet-terms" }],
  }),
  component: WalletTermsPage,
});

function WalletTermsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/wallet" className="rounded-full p-1 hover:bg-surface" aria-label="Înapoi">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-sm font-semibold">Regulament Portofel și program ambasador</h1>
      </header>

      <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 24 august 2026</p>

        <h2 className="mt-6 text-base font-semibold">1. Ce este creditul din portofel</h2>
        <p>
          Creditul afișat în portofel este un <strong>avantaj de fidelitate</strong> acordat
          gratuit de {OPERATOR.legalName} utilizatorilor care recomandă aplicația sau finalizează
          misiuni. Este exprimat în dolari doar ca unitate de calcul.{" "}
          <strong>Nu este monedă, nu este instrument de plată electronică</strong> în sensul Legii
          210/2019, nu poate fi retras în numerar, transferat altui cont sau schimbat în bani.
          Poate fi folosit exclusiv pentru comenzi de produse din catalogul Suzeta.
        </p>

        <h2 className="mt-6 text-base font-semibold">2. Cum acumulezi credit</h2>
        <ul className="list-disc pl-5">
          <li>Recomandare validată: creditul se acordă după ce contul invitat este verificat 18+.</li>
          <li>Misiuni active: creditul se acordă la îndeplinirea condiției afișate în misiune.</li>
          <li>
            Creditul apare inițial ca <em>în așteptare</em> și devine disponibil după perioada
            antifraudă afișată în portofel.
          </li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">3. Antifraudă</h2>
        <p>
          Conturile duplicate, invitațiile către conturi create de aceeași persoană, boți,
          automatizări sau orice manipulare a programului duc la anularea creditului aferent și,
          după caz, la suspendarea contului. Verificăm indicii tehnice (dispozitiv, tipare de
          înregistrare) în temeiul interesului legitim de prevenire a fraudei.
        </p>

        <h2 className="mt-6 text-base font-semibold">4. Comenzi de produse</h2>
        <p>
          Comanda se poate plasa de la soldul minim afișat în portofel. La plasarea comenzii se
          încheie un <strong>contract la distanță</strong> între tine, în calitate de consumator,
          și {OPERATOR.legalName}. Îți vom cere doar datele necesare livrării (nume, adresă,
          telefon de contact), pe care le transmitem curierului și producătorului de merch.
        </p>

        <h2 className="mt-6 text-base font-semibold">5. Dreptul de retragere (14 zile)</h2>
        <p>
          Conform OUG 34/2014, ai dreptul să te retragi din contract în{" "}
          <strong>14 zile calendaristice</strong> de la primirea produsului, fără motivare și fără
          penalități. Trimite o notificare la{" "}
          <a className="text-primary" href={`mailto:${OPERATOR.emails.support}`}>
            {OPERATOR.emails.support}
          </a>
          . Returnezi produsul în stare nefolosită; costul returului este suportat de tine, dacă nu
          s-a convenit altfel. La retragere, creditul folosit este restituit în portofel în maximum
          14 zile de la primirea produsului returnat. Produsele personalizate la cererea ta
          (Art. 16 lit. c) sunt exceptate de la retragere.
        </p>

        <h2 className="mt-6 text-base font-semibold">6. Conformitate și garanții</h2>
        <p>
          Produsele beneficiază de garanția legală de conformitate de 2 ani conform OUG 140/2021.
          Reclamațiile privind produse neconforme se trimit la{" "}
          <a className="text-primary" href={`mailto:${OPERATOR.emails.support}`}>
            {OPERATOR.emails.support}
          </a>{" "}
          și primesc răspuns în maximum 30 de zile.
        </p>

        <h2 className="mt-6 text-base font-semibold">7. Expirare, modificare, încetare</h2>
        <p>
          Creditul nu expiră cât timp contul este activ. La ștergerea contului, creditul neutilizat
          se pierde și nu se compensează. Putem modifica sumele acordate sau opri programul pentru
          viitor, cu anunț în aplicație cu cel puțin 14 zile înainte; creditul deja acumulat rămâne
          valabil 90 de zile de la anunțul de încetare.
        </p>

        <h2 className="mt-6 text-base font-semibold">8. Aspecte fiscale</h2>
        <p>
          Creditul reprezintă o reducere comercială aplicată produselor Suzeta, nu un venit plătit
          în bani. Dacă legislația impune raportări, te vom informa înainte de acordare.
        </p>

        <h2 className="mt-6 text-base font-semibold">9. Datele tale</h2>
        <p>
          Prelucrarea datelor din program este descrisă în{" "}
          <Link className="text-primary" to="/legal/privacy">
            Politica de confidențialitate
          </Link>{" "}
          și în{" "}
          <Link className="text-primary" to="/legal/records-of-processing">
            Registrul activităților de prelucrare
          </Link>{" "}
          (activitățile A18 și A19). Datele comenzilor se păstrează 5 ani pentru obligații
          contabile.
        </p>

        <h2 className="mt-6 text-base font-semibold">10. Reclamații, ANPC și SAL</h2>
        <p>
          Reclamații directe:{" "}
          <a className="text-primary" href={`mailto:${OPERATOR.emails.support}`}>
            {OPERATOR.emails.support}
          </a>
          . Consumatorii pot sesiza ANPC —{" "}
          <a className="text-primary" href="https://anpc.ro" target="_blank" rel="noreferrer">
            anpc.ro
          </a>{" "}
          și structura de soluționare alternativă a litigiilor —{" "}
          <a
            className="text-primary"
            href="https://anpc.ro/ce-este-sal/"
            target="_blank"
            rel="noreferrer"
          >
            anpc.ro/ce-este-sal/
          </a>
          . Platforma europeană SOL/ODR a fost închisă la 20 iulie 2025.
        </p>

        <h2 className="mt-6 text-base font-semibold">11. Operator</h2>
        <div className="mt-2">
          <OperatorIdentificationBlock includeIban />
        </div>
      </article>
    </div>
  );
}
