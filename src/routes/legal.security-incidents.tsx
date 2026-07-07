import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";
import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";


export const Route = createFileRoute("/legal/security-incidents")({
  head: () => ({
    meta: [
      { title: "Procedură incidente de securitate — Ventuza" },
      {
        name: "description",
        content: "Cum gestionăm și notificăm breșele de securitate conform GDPR Art. 33-34.",
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
        <h1 className="text-base font-semibold">Incidente de securitate</h1>
      </header>

      <LegalDocOverride
        slug="security-incidents"
        fallback={
          <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
            <p className="text-xs text-muted-foreground">
              Procedură conform GDPR Art. 33-34 · Ultima actualizare: 22 iunie 2026
            </p>

            <h2 className="mt-6 text-base font-semibold">1. Ce considerăm incident</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
              <li>Acces neautorizat la baza de date sau la fotografii private.</li>
              <li>Scurgere de date cu caracter personal (email, locație, mesaje).</li>
              <li>Compromiterea conturilor de administrator sau a cheilor service-role.</li>
              <li>Atac DDoS sau ransomware care afectează disponibilitatea.</li>
            </ul>

            <h2 className="mt-6 text-base font-semibold">2. Detectare</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
              <li>Monitoring continuu al logs de autentificare și rate-limit.</li>
              <li>Alerte automate pentru queries anormale și escaladări de privilegii.</li>
              <li>
                Raportare comunitate la{" "}
                <a className="text-primary" href="mailto:security@ventuza.app">
                  security@ventuza.app
                </a>
                .
              </li>
            </ul>

            <h2 className="mt-6 text-base font-semibold">3. Răspuns (în primele 24h)</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/85">
              <li>Izolare: blocarea vectorului (rotație chei, dezactivare cont compromis).</li>
              <li>Evaluare impact: ce date, câți utilizatori, sensibilitate.</li>
              <li>
                <strong>Documentare obligatorie în registrul intern de breșe</strong> — un
                incident nu este considerat închis până când nu are o intrare completă în
                registru: descriere, categorii de date afectate, număr persoane vizate,
                consecințe probabile, măsuri luate, evaluare risc conform Art. 33(3) GDPR.
                Registrul este ținut intern de {OPERATOR.legalName} și prezentat ANSPDCP la
                cerere.
              </li>
            </ol>

            <h2 className="mt-6 text-base font-semibold">
              4. Notificare ANSPDCP — obligatoriu în ≤72 de ore (GDPR Art. 33)
            </h2>
            <p className="mt-2 text-foreground/85">
              Conform <strong>Art. 33(1) GDPR</strong>, notificăm Autoritatea Națională de
              Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP){" "}
              <strong>fără întârzieri nejustificate și, dacă este posibil, în cel mult 72 de ore</strong>{" "}
              de la data la care operatorul a luat cunoștință de breșă, cu excepția cazurilor în
              care breșa este puțin probabil să genereze un risc pentru drepturile și libertățile
              persoanelor. Dacă notificarea depășește 72 de ore, includem motivele întârzierii.
            </p>
            <p className="mt-2 text-foreground/85">
              Canal oficial: formularul de pe{" "}
              <a
                className="text-primary"
                href="https://www.dataprotection.ro"
                target="_blank"
                rel="noreferrer"
              >
                dataprotection.ro
              </a>
              . Notificarea include: natura breșei, categoriile și numărul aproximativ de
              persoane vizate, datele de contact ale DPO, consecințele probabile, măsurile luate
              sau propuse pentru remediere (Art. 33(3) GDPR).
            </p>


            <h2 className="mt-6 text-base font-semibold">5. Notificare utilizatori (Art. 34)</h2>
            <p className="mt-2 text-foreground/85">
              Dacă incidentul implică risc ridicat pentru drepturile tale, te anunțăm direct prin
              email și notificare in-app, cu: ce date au fost afectate, ce măsuri am luat, ce poți
              face (schimbare parolă, monitorizare).
            </p>

            <h2 className="mt-6 text-base font-semibold">6. Raportează o vulnerabilitate</h2>
            <p className="mt-2 text-foreground/85">
              Cercetători de securitate: trimite raport responsabil la{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.security}`}>
                {OPERATOR.emails.security}
              </a>
              . Nu acționăm legal împotriva celor care respectă safe harbor (fără exfiltrare date,
              fără DoS, fără social engineering).
            </p>

            <h2 className="mt-6 text-base font-semibold">7. Operator</h2>
            <div className="mt-2">
              <OperatorIdentificationBlock compact />
            </div>

          </article>
        }
      />
    </div>
  );
}
