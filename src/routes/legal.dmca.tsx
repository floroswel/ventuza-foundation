import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";

export const Route = createFileRoute("/legal/dmca")({
  head: () => ({
    meta: [
      { title: "DMCA / Drepturi de autor — Ventuza" },
      {
        name: "description",
        content:
          "Procedura de notificare și retragere a conținutului care încalcă drepturile de autor pe Ventuza.",
      },
    ],
    links: [{ rel: "canonical", href: "https://ventuza-foundation.lovable.app/legal/dmca" }],
  }),
  component: DmcaPage,
});

function DmcaPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">DMCA / Drepturi de autor</h1>
      </header>

      <LegalDocOverride
        slug="dmca"
        fallback={
          <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
            <p className="text-xs text-muted-foreground">Ultima actualizare: 27 iunie 2026</p>

            <h2 className="mt-6 text-base font-semibold">1. Cadru legal</h2>
            <p className="mt-2 text-foreground/85">
              Ventuza respectă drepturile de autor conform Legii 8/1996 (România), Directivei (UE)
              2019/790 privind drepturile de autor în piața unică digitală, DSA (Reg. UE 2022/2065
              Art. 16) și, pentru raportori din SUA, principiilor procedurale ale Digital Millennium
              Copyright Act (DMCA).
            </p>

            <h2 className="mt-6 text-base font-semibold">
              2. Cum trimiți o notificare de retragere
            </h2>
            <p className="mt-2 text-foreground/85">
              Trimite o cerere semnată la{" "}
              <a className="text-primary" href="mailto:copyright@ventuza.app">
                copyright@ventuza.app
              </a>{" "}
              care să conțină OBLIGATORIU:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/85">
              <li>Identificarea operei protejate (titlu, autor, URL original dacă există).</li>
              <li>
                Identificarea exactă a conținutului de pe Ventuza (link profil, ID poză/mesaj,
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

            <h2 className="mt-6 text-base font-semibold">7. Contact</h2>
            <p className="mt-2 text-foreground/85">
              Copyright agent:{" "}
              <a className="text-primary" href="mailto:copyright@ventuza.app">
                copyright@ventuza.app
              </a>{" "}
              · DPO:{" "}
              <a className="text-primary" href="mailto:dpo@ventuza.app">
                dpo@ventuza.app
              </a>{" "}
              · DSA:{" "}
              <Link className="text-primary" to="/legal/dsa">
                /legal/dsa
              </Link>
            </p>
          </article>
        }
      />
    </div>
  );
}
