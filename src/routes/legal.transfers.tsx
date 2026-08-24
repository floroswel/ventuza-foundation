import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";

export const Route = createFileRoute("/legal/transfers")({
  head: () => ({
    meta: [
      { title: "Transferuri de date în afara UE (SCC / DPF) — Suzeta" },
      {
        name: "description",
        content:
          "Lista completă a transferurilor de date personale în afara Spațiului Economic European: entitate, țară, scop, categorii de date și garanțiile aplicate (Clauze Contractuale Standard, EU-US Data Privacy Framework, decizii de adecvare).",
      },
      { property: "og:title", content: "Transferuri extra-UE (SCC / DPF) — Suzeta" },
      {
        property: "og:description",
        content:
          "Entitățile, țările, scopurile și garanțiile pentru transferurile de date Suzeta în afara SEE.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.ro/legal/transfers" }],
  }),
  component: TransfersPage,
});

type Transfer = {
  entity: string;
  country: string;
  purpose: string;
  data: string;
  safeguard: "SCC" | "SCC + DPF" | "Adecvare";
  safeguardDetail: string;
  supplementary: string;
  docUrl: string;
};

const TRANSFERS: Transfer[] = [
  {
    entity: "Google LLC (Google Play Billing — Android Publisher API)",
    country: "Statele Unite ale Americii",
    purpose: "Validare server-to-server a abonamentelor Premium cumpărate pe Android.",
    data: "purchase_token, productId, UUID intern de utilizator. Fără nume, email, locație sau date Art. 9.",
    safeguard: "SCC + DPF",
    safeguardDetail:
      "Clauze Contractuale Standard (Decizia (UE) 2021/914, Modulul 2 operator → împuternicit) + EU-US Data Privacy Framework (Google LLC este entitate certificată).",
    supplementary:
      "Pseudonimizare completă: identificatorul transmis este un UUID intern care nu poate fi corelat cu o persoană fără baza noastră de date, găzduită în UE.",
    docUrl: "https://privacy.google.com/businesses/processorterms/",
  },
  {
    entity: "Google LLC (Firebase Cloud Messaging) / Apple Inc. (APNs)",
    country: "Statele Unite ale Americii",
    purpose: "Livrarea notificărilor push către dispozitivul utilizatorului (protocol VAPID).",
    data: "Endpoint-ul push al dispozitivului + un titlu/corp scurt al notificării (ex. „Ai un mesaj nou”).",
    safeguard: "SCC + DPF",
    safeguardDetail:
      "Clauze Contractuale Standard (2021/914) + EU-US Data Privacy Framework (Google, Apple certificate).",
    supplementary:
      "Payload minimizat prin politica internă de confidențialitate a notificărilor: niciodată conținutul mesajului, numele expeditorului complet, date de sănătate, orientare sau locație.",
    docUrl: "https://policies.google.com/terms",
  },
  {
    entity: "RevenueCat, Inc.",
    country: "Statele Unite ale Americii",
    purpose:
      "Orchestrarea abonamentelor cross-platform și anularea lor la ștergerea contului (Art. 17).",
    data: "app_user_id (UUID intern), identificator achiziție, status abonament.",
    safeguard: "SCC + DPF",
    safeguardDetail: "Clauze Contractuale Standard (2021/914) + EU-US Data Privacy Framework.",
    supplementary: "Fără email, fără date demografice, fără date din categorii speciale.",
    docUrl: "https://www.revenuecat.com/dpa/",
  },
  {
    entity: "Cloudflare, Inc.",
    country: "Statele Unite ale Americii (rețea edge globală)",
    purpose: "Edge runtime pentru funcțiile de server și CDN pentru resursele statice.",
    data: "Trafic HTTP/S în tranzit (headere, adresă IP, payload), procesat în memorie, fără persistență la procesator.",
    safeguard: "SCC + DPF",
    safeguardDetail:
      "Clauze Contractuale Standard (2021/914) + EU-US Data Privacy Framework (Cloudflare certificat).",
    supplementary:
      "Criptare TLS 1.2+ end-to-end; datele nu sunt stocate la nivel edge; politica publică a furnizorului privind cererile autorităților și transparența acestora.",
    docUrl: "https://www.cloudflare.com/cloudflare-customer-dpa/",
  },
  {
    entity: "Lovable AI Gateway (și sub-procesatorii de modele, ex. Google)",
    country: "Uniunea Europeană / Statele Unite (în funcție de modelul rutat)",
    purpose: "Moderarea automată a conținutului, asistență la redactarea bio, embeddings.",
    data: "Exclusiv textul trimis explicit la moderare sau generare.",
    safeguard: "SCC + DPF",
    safeguardDetail:
      "Clauze Contractuale Standard (2021/914) pentru sub-procesatorii din SUA + EU-US Data Privacy Framework unde este aplicabil.",
    supplementary:
      "Nu trimitem niciodată date de sănătate, orientare codificată sau coordonate. Prelucrarea este condiționată de consimțământul „ai_features”.",
    docUrl: "https://lovable.dev/legal/dpa",
  },
  {
    entity: "OpenStreetMap Foundation",
    country: "Regatul Unit",
    purpose: "Servirea tile-urilor de hartă pentru funcția „Aproape de tine”.",
    data: "Adresa IP a dispozitivului și zona (bounding box) hărții vizualizate. Fără cont, fără coordonatele exacte ale utilizatorului.",
    safeguard: "Adecvare",
    safeguardDetail:
      "Decizia de adecvare a Comisiei Europene pentru Regatul Unit (Decizia (UE) 2021/1772).",
    supplementary:
      "Harta cere doar tile-uri pentru zona afișată; poziția precisă a utilizatorului nu este transmisă.",
    docUrl: "https://wiki.osmfoundation.org/wiki/Privacy_Policy",
  },
];

const BADGE: Record<Transfer["safeguard"], string> = {
  SCC: "bg-amber-500/15 text-amber-600",
  "SCC + DPF": "bg-amber-500/15 text-amber-600",
  Adecvare: "bg-emerald-500/15 text-emerald-600",
};

function TransfersPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/legal/dpa"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Transferuri în afara UE</h1>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 25 august 2026</p>

        <div className="mt-4">
          <OperatorIdentificationBlock compact />
        </div>

        <p className="mt-4">
          Baza de date principală a aplicației <strong>{OPERATOR.brand}</strong> este găzduită în
          Uniunea Europeană (Frankfurt, Germania). Anumite servicii auxiliare implică însă transferul
          unor date personale către entități din afara Spațiului Economic European. Conform art.
          44–49 GDPR, mai jos sunt toate aceste transferuri, cu entitatea destinatară, țara, scopul,
          categoriile de date și garanțiile aplicate.
        </p>

        <h2 className="mt-6 text-base font-semibold">Mecanismele de transfer folosite</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>
            <strong>SCC</strong> — Clauzele Contractuale Standard ale Comisiei Europene, Decizia de
            punere în aplicare (UE) 2021/914, Modulul 2 (operator → împuternicit), completate cu o
            evaluare a impactului transferului (TIA) și cu măsuri suplimentare tehnice (criptare,
            pseudonimizare, minimizare).
          </li>
          <li>
            <strong>DPF</strong> — EU-US Data Privacy Framework, Decizia de adecvare a Comisiei
            Europene din 10 iulie 2023, pentru entitățile americane certificate.
          </li>
          <li>
            <strong>Adecvare</strong> — decizie de adecvare a Comisiei Europene pentru țara
            destinatară (ex. Regatul Unit, Decizia (UE) 2021/1772).
          </li>
        </ul>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">Entitate</th>
                <th className="px-3 py-2 text-left">Țară</th>
                <th className="px-3 py-2 text-left">Scop</th>
                <th className="px-3 py-2 text-left">Categorii de date</th>
                <th className="px-3 py-2 text-left">Garanție</th>
                <th className="px-3 py-2 text-left">Măsuri suplimentare</th>
              </tr>
            </thead>
            <tbody>
              {TRANSFERS.map((t) => (
                <tr key={t.entity} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">
                    {t.entity}
                    <div className="mt-1">
                      <a
                        className="text-primary underline"
                        href={t.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        DPA / DPF
                      </a>
                    </div>
                  </td>
                  <td className="px-3 py-2">{t.country}</td>
                  <td className="px-3 py-2">{t.purpose}</td>
                  <td className="px-3 py-2">{t.data}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${BADGE[t.safeguard]}`}
                    >
                      {t.safeguard}
                    </span>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {t.safeguardDetail}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[11px]">{t.supplementary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-base font-semibold">Ce NU transferăm niciodată extra-UE</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>Coordonatele GPS precise ale utilizatorilor — nu părăsesc baza de date din UE.</li>
          <li>
            Datele din categorii speciale (art. 9): status HIV, orientare, identitate de gen — sunt
            cifrate la nivel de coloană și nu sunt transmise niciunui procesator extra-UE.
          </li>
          <li>Conținutul mesajelor private și media din albume private.</li>
          <li>Selfie-ul de verificare 18+ — este procesat exclusiv în SEE (Didit).</li>
        </ul>

        <h2 className="mt-8 text-base font-semibold">Drepturile tale</h2>
        <p className="mt-2 text-xs">
          Poți obține o copie a garanțiilor aplicate (SCC semnate, în forma permisă de
          confidențialitatea comercială) și poți exercita orice drept GDPR prin{" "}
          <Link className="text-primary" to="/legal/gdpr-request">
            formularul de cereri GDPR
          </Link>{" "}
          sau scriind la{" "}
          <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
            {OPERATOR.emails.dpo}
          </a>
          .
        </p>

        <p className="mt-6 text-xs text-muted-foreground">
          Vezi și{" "}
          <Link className="text-primary" to="/legal/subprocessors">
            lista completă de subprocesatori
          </Link>{" "}
          și{" "}
          <Link className="text-primary" to="/legal/dpa">
            Acordul de prelucrare a datelor (DPA)
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
