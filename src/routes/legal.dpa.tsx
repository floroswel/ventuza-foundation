import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Globe2 } from "lucide-react";

import { LegalHeader, useLegalLang } from "@/components/legal/LegalLang";
import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";
import { CURRENT_DPA, DPA_VERSIONS, formatLegalDate } from "@/lib/legal-versions";

export const Route = createFileRoute("/legal/dpa")({
  head: () => ({
    meta: [
      { title: "Acord de prelucrare a datelor (DPA) — Suzeta" },
      {
        name: "description",
        content:
          "Acordul de prelucrare a datelor conform Art. 28 GDPR între Suzeta și partenerii B2B: obiect, durată, măsuri de securitate, subprocesatori și transferuri.",
      },
      { property: "og:title", content: "Acord de prelucrare a datelor (DPA) — Suzeta" },
      {
        property: "og:description",
        content: "DPA Art. 28 GDPR pentru partenerii și advertiserii Suzeta.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.ro/legal/dpa" }],
  }),
  component: DpaPage,
});

const SECURITY_MEASURES = [
  "Criptare în tranzit (TLS 1.2+) pentru toate conexiunile și criptare la repaus a bazei de date.",
  "Criptare la nivel de coloană (pgcrypto) pentru câmpurile sensibile, cu chei păstrate în seif de secrete, separat de baza de date.",
  "Control de acces pe rând (Row Level Security) în baza de date, cu politici scoped pe identitatea utilizatorului.",
  "Roluri administrative separate, autentificare cu doi factori obligatorie pentru acțiunile cu impact și jurnal de audit append-only.",
  "Principiul minimizării: datele sensibile sunt mascate implicit în panourile interne; dezvăluirea necesită procedură de tip break-glass, motivată și înregistrată.",
  "Copii de siguranță zilnice, cu procedură documentată de restaurare și testare periodică.",
  "Politică de retenție și ștergere automată a datelor la expirarea termenelor sau la cererea persoanei vizate.",
  "Pseudonimizare acolo unde scopul o permite; locația precisă a utilizatorilor nu este niciodată expusă altor utilizatori sau partenerilor.",
];

function DpaPage() {
  const [lang, setLang] = useLegalLang();
  const en = lang === "en";

  return (
    <div className="min-h-dvh bg-background">
      <LegalHeader
        lang={lang}
        onLang={setLang}
        ro="Acord de prelucrare a datelor (DPA)"
        en="Data Processing Agreement (DPA)"
      />
      <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">
          {en
            ? `Version ${CURRENT_DPA.version} — last updated ${formatLegalDate(CURRENT_DPA.date, "en")}`
            : `Versiunea ${CURRENT_DPA.version} — ultima actualizare: ${formatLegalDate(CURRENT_DPA.date)}`}
        </p>

        <div className="mt-4 flex flex-wrap gap-2 not-prose">
          <a
            href={CURRENT_DPA.file}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface/70"
          >
            <Download className="size-4" />
            {en
              ? `Download PDF (v${CURRENT_DPA.version})`
              : `Descarcă PDF (v${CURRENT_DPA.version})`}
          </a>
          <Link
            to="/legal/transfers"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface/70"
          >
            <Globe2 className="size-4" />
            {en ? "Non-EU transfers (SCC / DPF)" : "Transferuri extra-UE (SCC / DPF)"}
          </Link>
          <Link
            to="/legal/subprocessors"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface/70"
          >
            {en ? "Subprocessors" : "Subprocesatori"}
          </Link>
        </div>


        <p className="mt-4">
          {en ? (
            <>
              This Data Processing Agreement (&quot;DPA&quot;) forms an integral part of the{" "}
              <Link className="text-primary" to="/legal/business-terms">
                Business Terms
              </Link>{" "}
              concluded between {OPERATOR.legalName} and any business partner, venue owner or
              advertiser (&quot;Partner&quot;) using the {OPERATOR.brand} platform. It is entered
              into pursuant to Article 28 of Regulation (EU) 2016/679 (GDPR).
            </>
          ) : (
            <>
              Acest Acord de prelucrare a datelor („DPA”) face parte integrantă din{" "}
              <Link className="text-primary" to="/legal/business-terms">
                Termenii B2B
              </Link>{" "}
              încheiați între {OPERATOR.legalName} și orice partener de business, deținător de local
              sau advertiser („Partenerul”) care folosește platforma {OPERATOR.brand}. Este încheiat
              în temeiul art. 28 din Regulamentul (UE) 2016/679 (GDPR).
            </>
          )}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "1. Roles of the parties" : "1. Rolurile părților"}
        </h2>
        <p>
          {en
            ? `For end-user data collected through the ${OPERATOR.brand} app (accounts, profiles, messages, verification), ${OPERATOR.legalName} acts as controller and the Partner has no access. For data the Partner submits about its own venue, events and offers, and for aggregated, non-identifying statistics returned to the Partner, ${OPERATOR.legalName} acts as processor on the Partner's instructions. Where the Partner processes personal data of its own customers outside the platform, the Partner is an independent controller.`
            : `Pentru datele utilizatorilor finali colectate prin aplicația ${OPERATOR.brand} (conturi, profiluri, mesaje, verificare), ${OPERATOR.legalName} este operator, iar Partenerul nu are acces la ele. Pentru datele pe care Partenerul le transmite despre propriul local, evenimente și oferte, precum și pentru statisticile agregate, neidentificatoare, returnate Partenerului, ${OPERATOR.legalName} acționează ca persoană împuternicită, pe baza instrucțiunilor Partenerului. Atunci când Partenerul prelucrează date ale propriilor clienți în afara platformei, Partenerul este operator independent.`}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "2. Subject matter, duration, nature and purpose" : "2. Obiect, durată, natură și scop"}
        </h2>
        <ul className="list-disc pl-5">
          <li>
            <strong>{en ? "Subject matter" : "Obiect"}:</strong>{" "}
            {en
              ? "hosting, storage, moderation and display of Partner content within the app, plus generation of aggregated performance statistics."
              : "găzduirea, stocarea, moderarea și afișarea conținutului Partenerului în aplicație, plus generarea de statistici agregate de performanță."}
          </li>
          <li>
            <strong>{en ? "Duration" : "Durată"}:</strong>{" "}
            {en
              ? "for the term of the Business Terms, plus the retention periods described below."
              : "pe durata Termenilor B2B, plus termenele de retenție descrise mai jos."}
          </li>
          <li>
            <strong>{en ? "Nature and purpose" : "Natură și scop"}:</strong>{" "}
            {en
              ? "collection, storage, organisation, consultation, disclosure within the app, erasure."
              : "colectare, stocare, organizare, consultare, dezvăluire în cadrul aplicației, ștergere."}
          </li>
          <li>
            <strong>{en ? "Categories of data subjects" : "Categorii de persoane vizate"}:</strong>{" "}
            {en
              ? "Partner's contact persons and representatives; app users interacting with Partner content."
              : "persoanele de contact și reprezentanții Partenerului; utilizatorii aplicației care interacționează cu conținutul Partenerului."}
          </li>
          <li>
            <strong>{en ? "Categories of personal data" : "Categorii de date"}:</strong>{" "}
            {en
              ? "identification and contact details, billing data, content submitted by the Partner, technical logs. No special-category data is processed on the Partner's behalf."
              : "date de identificare și contact, date de facturare, conținutul transmis de Partener, jurnale tehnice. Nu se prelucrează date din categorii speciale în numele Partenerului."}
          </li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "3. Instructions" : "3. Instrucțiuni"}
        </h2>
        <p>
          {en
            ? "We process personal data only on documented instructions from the Partner, including as regards transfers, unless required by Union or Member State law. If we consider an instruction to infringe data protection law, we will inform the Partner without delay and may suspend execution of that instruction."
            : "Prelucrăm datele exclusiv pe baza instrucțiunilor documentate ale Partenerului, inclusiv privind transferurile, cu excepția cazurilor impuse de dreptul Uniunii sau al unui stat membru. Dacă apreciem că o instrucțiune încalcă legislația privind protecția datelor, informăm Partenerul fără întârziere și putem suspenda executarea acelei instrucțiuni."}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "4. Confidentiality" : "4. Confidențialitate"}
        </h2>
        <p>
          {en
            ? "All personnel authorised to process personal data are bound by confidentiality obligations and are granted access strictly on a need-to-know basis."
            : "Întregul personal autorizat să prelucreze date personale este ținut de obligații de confidențialitate, iar accesul se acordă strict pe baza principiului necesității de a cunoaște."}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "5. Security measures (Art. 32)" : "5. Măsuri de securitate (art. 32)"}
        </h2>
        <ul className="list-disc pl-5">
          {SECURITY_MEASURES.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "6. Sub-processors" : "6. Subprocesatori"}
        </h2>
        <p>
          {en ? (
            <>
              The Partner grants general written authorisation for the sub-processors listed at{" "}
              <Link className="text-primary" to="/legal/subprocessors">
                /legal/subprocessors
              </Link>
              . We keep that list current and will notify Partners at least 30 days before adding or
              replacing a sub-processor, allowing the Partner to object on reasonable data
              protection grounds. Each sub-processor is bound by equivalent obligations.
            </>
          ) : (
            <>
              Partenerul acordă o autorizare generală scrisă pentru subprocesatorii listați la{" "}
              <Link className="text-primary" to="/legal/subprocessors">
                /legal/subprocessors
              </Link>
              . Menținem lista actualizată și notificăm Partenerii cu cel puțin 30 de zile înainte de
              adăugarea sau înlocuirea unui subprocesator, Partenerul putând obiecta pentru motive
              rezonabile de protecție a datelor. Fiecare subprocesator este ținut de obligații
              echivalente.
            </>
          )}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "7. International transfers" : "7. Transferuri internaționale"}
        </h2>
        <p>
          {en
            ? "Primary storage is in the European Union. Where a sub-processor is located outside the EEA, transfers rely on the Standard Contractual Clauses (Decision (EU) 2021/914), an adequacy decision, or the EU–US Data Privacy Framework, together with supplementary technical measures. The applicable mechanism per sub-processor is stated in the sub-processor list."
            : "Stocarea principală este în Uniunea Europeană. Atunci când un subprocesator este situat în afara SEE, transferurile se bazează pe Clauzele Contractuale Standard (Decizia (UE) 2021/914), o decizie de adecvare sau EU–US Data Privacy Framework, împreună cu măsuri tehnice suplimentare. Mecanismul aplicabil fiecărui subprocesator este indicat în lista de subprocesatori."}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "8. Assistance to the Partner" : "8. Asistență acordată Partenerului"}
        </h2>
        <p>
          {en
            ? "Taking into account the nature of the processing, we assist the Partner with appropriate technical and organisational measures in responding to data subject requests (Chapter III GDPR) and in complying with Articles 32–36 (security, breach notification, impact assessments, prior consultation)."
            : "Ținând cont de natura prelucrării, asistăm Partenerul prin măsuri tehnice și organizatorice adecvate în soluționarea cererilor persoanelor vizate (Capitolul III GDPR) și în respectarea art. 32–36 (securitate, notificarea încălcărilor, evaluări de impact, consultare prealabilă)."}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "9. Personal data breaches" : "9. Încălcări ale securității datelor"}
        </h2>
        <p>
          {en ? (
            <>
              We notify the Partner without undue delay and in any case within 24 hours of becoming
              aware of a personal data breach affecting data processed on the Partner&apos;s behalf,
              with the information available at that time. Our incident procedure is published at{" "}
              <Link className="text-primary" to="/legal/security-incidents">
                /legal/security-incidents
              </Link>
              .
            </>
          ) : (
            <>
              Notificăm Partenerul fără întârzieri nejustificate și, în orice caz, în maximum 24 de
              ore de la luarea la cunoștință despre o încălcare a securității datelor prelucrate în
              numele Partenerului, cu informațiile disponibile la acel moment. Procedura noastră de
              incident este publicată la{" "}
              <Link className="text-primary" to="/legal/security-incidents">
                /legal/security-incidents
              </Link>
              .
            </>
          )}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "10. Return and deletion" : "10. Returnare și ștergere"}
        </h2>
        <p>
          {en
            ? "On termination, and at the Partner's choice, we delete or return the personal data processed on the Partner's behalf and delete existing copies, unless Union or Member State law requires storage (e.g. accounting records kept for 5 years, invoices for 10 years under Romanian law)."
            : "La încetare, la alegerea Partenerului, ștergem sau returnăm datele prelucrate în numele Partenerului și ștergem copiile existente, cu excepția cazului în care dreptul Uniunii sau al unui stat membru impune păstrarea (de ex. documente contabile 5 ani, facturi 10 ani conform legislației române)."}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "11. Audits" : "11. Audituri"}
        </h2>
        <p>
          {en
            ? "We make available all information necessary to demonstrate compliance with Article 28 and allow for and contribute to audits, including inspections, conducted by the Partner or an independent auditor mandated by the Partner, with at least 30 days' written notice, no more than once per year (unless triggered by an incident), during business hours and subject to confidentiality."
            : "Punem la dispoziție toate informațiile necesare pentru a demonstra respectarea art. 28 și permitem și contribuim la audituri, inclusiv inspecții, realizate de Partener sau de un auditor independent mandatat de acesta, cu un preaviz scris de cel puțin 30 de zile, cel mult o dată pe an (cu excepția cazurilor declanșate de un incident), în timpul programului de lucru și sub obligație de confidențialitate."}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "12. Liability and governing law" : "12. Răspundere și lege aplicabilă"}
        </h2>
        <p>
          {en
            ? "Liability is governed by the Business Terms and by Article 82 GDPR. This DPA is governed by Romanian law; competent courts are those of Romania. In case of conflict, this DPA prevails over the Business Terms on data protection matters."
            : "Răspunderea este guvernată de Termenii B2B și de art. 82 GDPR. Prezentul DPA este guvernat de legea română; instanțele competente sunt cele din România. În caz de conflict, prezentul DPA prevalează asupra Termenilor B2B în privința protecției datelor."}
        </p>

        <h2 className="mt-6 text-base font-semibold">
          {en ? "13. Signature and contact" : "13. Semnare și contact"}
        </h2>
        <p>
          {en ? (
            <>
              This DPA is accepted electronically when the Partner accepts the Business Terms. A
              countersigned PDF copy is available on request at{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
                {OPERATOR.emails.dpo}
              </a>
              .
            </>
          ) : (
            <>
              Prezentul DPA se acceptă electronic în momentul acceptării Termenilor B2B. O copie PDF
              contrasemnată este disponibilă la cerere, la{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
                {OPERATOR.emails.dpo}
              </a>
              .
            </>
          )}
        </p>

        <h2 className="mt-8 text-base font-semibold">
          {en ? "Version history (PDF)" : "Istoricul versiunilor (PDF)"}
        </h2>
        <ul className="mt-2 space-y-2 text-xs not-prose">
          {DPA_VERSIONS.map((v) => (
            <li
              key={v.version}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2"
            >
              <span>
                <strong>v{v.version}</strong> · {formatLegalDate(v.date, en ? "en" : "ro")}
                {v.current && (
                  <span className="ml-2 rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">
                    {en ? "In force" : "În vigoare"}
                  </span>
                )}
                <span className="block text-muted-foreground">{v.notes}</span>
              </span>
              <a className="text-primary underline" href={v.file} download>
                PDF
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <OperatorIdentificationBlock includeIban />
        </div>

      </article>
    </div>
  );
}
