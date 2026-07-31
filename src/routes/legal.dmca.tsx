import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";
import { LegalHeader, useLegalLang } from "@/components/legal/LegalLang";
import { DmcaEn } from "@/components/legal/en/PolicyLegalEn";
import {
  OPERATOR,
  OPERATOR_INTRO,
  OperatorIdentificationBlock,
} from "@/components/legal/OperatorInfo";

export const Route = createFileRoute("/legal/dmca")({
  head: () => ({
    meta: [
      { title: "DMCA / Drepturi de autor — Suzeta" },
      {
        name: "description",
        content:
          "Procedura de notificare și retragere a conținutului care încalcă drepturile de autor pe Suzeta.",
      },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/legal/dmca" }],
  }),
  component: DmcaPage,
});

function DmcaPage() {
  const [lang, setLang] = useLegalLang();
  return (
    <div className="min-h-dvh bg-background">
      <LegalHeader
        lang={lang}
        onLang={setLang}
        ro={"DMCA / Drepturi de autor"}
        en={"DMCA / Copyright"}
      />

      {lang === "en" ? (
        <DmcaEn />
      ) : (
        <LegalDocOverride
          slug="dmca"
          fallback={
            <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
              <p className="text-xs text-muted-foreground">Ultima actualizare: 27 iunie 2026</p>

              <h2 className="mt-6 text-base font-semibold">1. Cadru legal</h2>
              <p className="mt-2 text-foreground/85">
                {OPERATOR_INTRO} respectă drepturile de autor conform Legii 8/1996 (România),
                Directivei (UE) 2019/790 privind drepturile de autor în piața unică digitală, DSA
                (Reg. UE 2022/2065 Art. 16) și, pentru raportori din SUA, principiilor procedurale
                ale Digital Millennium Copyright Act (DMCA).
              </p>

              <h2 className="mt-6 text-base font-semibold">
                2. Cum trimiți o notificare de retragere
              </h2>
              <p className="mt-2 text-foreground/85">
                Trimite o cerere semnată la{" "}
                <a className="text-primary" href="mailto:copyright@suzeta.app">
                  copyright@suzeta.app
                </a>{" "}
                care să conțină OBLIGATORIU:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/85">
                <li>Identificarea operei protejate (titlu, autor, URL original dacă există).</li>
                <li>
                  Identificarea exactă a conținutului de pe Suzeta (link profil, ID poză/mesaj,
                  capturi).
                </li>
                <li>Datele tale de contact: nume complet, adresă, telefon, email.</li>
                <li>
                  Declarație pe propria răspundere că deții drepturile sau acționezi în numele
                  titularului.
                </li>
                <li>Declarație că informațiile sunt corecte și că ești autorizat să acționezi.</li>
                <li>Semnătură electronică sau olografă scanată.</li>
              </ol>

              <h2 className="mt-6 text-base font-semibold">3. Termen de răspuns</h2>
              <p className="mt-2 text-foreground/85">
                Confirmăm primirea în <strong>24h</strong>. Eliminăm conținutul vădit ilegal în
                maximum <strong>48h</strong>. Notificăm utilizatorul care a postat și îi oferim
                dreptul la contra-notificare.
              </p>

              <h2 className="mt-6 text-base font-semibold">4. Contra-notificare</h2>
              <p className="mt-2 text-foreground/85">
                Dacă crezi că retragerea este nejustificată, trimite contra-notificare la aceeași
                adresă, cu identificarea conținutului, motivul, datele tale și consimțământul pentru
                jurisdicția instanțelor române. Republicăm conținutul în 10–14 zile lucrătoare dacă
                reclamantul nu deschide acțiune în instanță.
              </p>

              <h2 className="mt-6 text-base font-semibold">5. Notificări abuzive</h2>
              <p className="mt-2 text-foreground/85">
                Notificările făcute cu rea-credință (false claims) pot atrage răspundere civilă
                conform Art. 196 din Legea 8/1996. Suspendăm dreptul de a trimite notificări
                utilizatorilor care abuzează procedura.
              </p>

              <h2 className="mt-6 text-base font-semibold">6. Repeat infringer policy</h2>
              <p className="mt-2 text-foreground/85">
                Conturile cu trei (3) notificări validate într-un interval de 12 luni sunt închise
                permanent.
              </p>

              <h2 className="mt-6 text-base font-semibold">7. Operator și contact</h2>
              <div className="mt-2">
                <OperatorIdentificationBlock compact />
              </div>
              <p className="mt-3 text-foreground/85">
                Copyright agent:{" "}
                <a className="text-primary" href={`mailto:${OPERATOR.emails.copyright}`}>
                  {OPERATOR.emails.copyright}
                </a>{" "}
                · DPO:{" "}
                <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
                  {OPERATOR.emails.dpo}
                </a>{" "}
                · DSA:{" "}
                <Link className="text-primary" to="/legal/dsa">
                  /legal/dsa
                </Link>
              </p>
            </article>
          }
        />
      )}
    </div>
  );
}
