import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";
import { LegalHeader, useLegalLang } from "@/components/legal/LegalLang";
import { DsaEn } from "@/components/legal/en/PolicyLegalEn";
import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";

export const Route = createFileRoute("/legal/dsa")({
  head: () => ({
    meta: [
      { title: "Transparență DSA — Suzeta" },
      {
        name: "description",
        content: "Raport de transparență și punct unic de contact conform Digital Services Act.",
      },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/legal/dsa" }],
  }),
  component: DsaPage,
});

function DsaPage() {
  const [lang, setLang] = useLegalLang();
  return (
    <div className="min-h-dvh bg-background">
      <LegalHeader lang={lang} onLang={setLang} ro={"Transparență DSA"} en={"DSA transparency"} />
      {lang === "en" ? (
        <DsaEn />
      ) : (
        <LegalDocOverride
          slug="dsa"
          fallback={
            <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
              <p className="text-xs text-muted-foreground">Ultima actualizare: 22 iunie 2026</p>

              <h2 className="mt-6 text-base font-semibold">Identificare furnizor de serviciu</h2>
              <div className="mt-2">
                <OperatorIdentificationBlock compact />
              </div>

              <h2 className="mt-6 text-base font-semibold">
                Punct unic de contact (DSA Art. 11–12)
              </h2>
              <ul className="list-disc pl-5">
                <li>
                  Pentru autorități:{" "}
                  <a className="text-primary" href={`mailto:${OPERATOR.emails.dsa}`}>
                    {OPERATOR.emails.dsa}
                  </a>
                </li>
                <li>
                  Pentru utilizatori:{" "}
                  <a className="text-primary" href={`mailto:${OPERATOR.emails.trust}`}>
                    {OPERATOR.emails.trust}
                  </a>
                </li>
                <li>Limbi: română, engleză</li>
              </ul>

              <h2 className="mt-6 text-base font-semibold">
                Mecanism notificare conținut ilegal (Art. 16)
              </h2>
              <p>
                Orice utilizator sau autoritate poate raporta conținut presupus ilegal prin butonul
                "Raportează" din aplicație sau prin email la{" "}
                <a className="text-primary" href="mailto:trust@suzeta.ro">
                  trust@suzeta.ro
                </a>
                . Confirmăm primirea în 24h și luăm decizia în maximum 7 zile.
              </p>

              <h2 className="mt-6 text-base font-semibold">Drept de contestare (Art. 20)</h2>
              <p>
                Deciziile de moderare pot fi contestate gratuit, intern, în termen de 14 zile, la{" "}
                <a className="text-primary" href="mailto:appeals@suzeta.ro">
                  appeals@suzeta.ro
                </a>
                . Răspuns uman în maximum 7 zile.
              </p>

              <h2 className="mt-6 text-base font-semibold">Raport de transparență (Art. 15)</h2>
              <p>
                Publicăm anual statistici despre: numărul de notificări primite, acțiuni
                întreprinse, conturi suspendate, mediană timp de răspuns. Primul raport va fi
                publicat la 12 luni de la lansarea publică.
              </p>

              <h2 className="mt-6 text-base font-semibold">
                Autoritate coordonatoare DSA în România
              </h2>
              <p>
                ANCOM —{" "}
                <a
                  className="text-primary"
                  href="https://www.ancom.ro"
                  target="_blank"
                  rel="noreferrer"
                >
                  ancom.ro
                </a>
              </p>

              <h2 className="mt-6 text-base font-semibold">Reprezentant legal în UE</h2>
              <p>
                {OPERATOR.legalName} este stabilită în România (UE), deci nu este necesar un
                reprezentant separat conform DSA Art. 13.
              </p>
            </article>
          }
        />
      )}
    </div>
  );
}
