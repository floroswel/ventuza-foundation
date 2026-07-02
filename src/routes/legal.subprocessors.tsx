import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/subprocessors")({
  head: () => ({
    meta: [
      { title: "Subprocesatori — Ventuza" },
      { name: "description", content: "Lista terților care procesează date în numele Ventuza." },
    ],
    links: [
      { rel: "canonical", href: "https://ventuza-foundation.lovable.app/legal/subprocessors" },
    ],
  }),
  component: SubsPage,
});

type Row = {
  name: string;
  purpose: string;
  data: string;
  sensitive: boolean;
  region: string;
  extraEU: boolean;
  transfer: string;
  dpa: string;
  codeRef: string;
};

const ROWS: Row[] = [
  {
    name: "Supabase (via Lovable Cloud)",
    purpose: "Bază de date, autentificare, stocare fotografii/voice/video, realtime",
    data: "Toate datele de cont și profil, inclusiv categorii speciale (orientare, sănătate), locație precisă (doar pentru owner via RLS), mesaje, media.",
    sensitive: true,
    region: "UE — aws-1-eu-central-1 (Frankfurt, Germania)",
    extraEU: false,
    transfer: "Intra-UE. Sub-procesatori AWS US sub SCC + DPF.",
    dpa: "https://supabase.com/legal/dpa",
    codeRef: "src/integrations/supabase/*",
  },
  {
    name: "Google LLC — Google Play Billing (Android Publisher API)",
    purpose: "Validare server-to-server a abonamentelor Premium pe Android",
    data: "purchase_token, productId, app_user_id (UUID intern). Fără PII demografic, fără date de sănătate, fără orientare, fără locație.",
    sensitive: false,
    region: "Extra-UE (SUA, global)",
    extraEU: true,
    transfer: "SCC 2021/914 + EU-US Data Privacy Framework (Google certificat DPF).",
    dpa: "https://privacy.google.com/businesses/processorterms/",
    codeRef: "src/lib/google-play.server.ts",
  },
  {
    name: "Google LLC — Google Sign-In (OAuth)",
    purpose: "Autentificare cu cont Google (broker prin Lovable)",
    data: "Email, nume afișat, sub (ID Google), avatar URL. Fără orientare, fără sănătate, fără locație.",
    sensitive: false,
    region: "Extra-UE (SUA)",
    extraEU: true,
    transfer: "SCC 2021/914 + EU-US DPF.",
    dpa: "https://privacy.google.com/businesses/processorterms/",
    codeRef: "src/lib/auth-context.tsx (lovable.auth.signInWithOAuth)",
  },
  {
    name: "Push services (Google FCM / Mozilla autopush / Apple APNs)",
    purpose: "Livrare notificări push web/PWA prin protocol VAPID",
    data: "Endpoint URL al device-ului + payload notificare (titlu + scurt body — niciodată conținut sensibil; ex. „Mesaj nou”). Fără sănătate, fără orientare, fără locație.",
    sensitive: false,
    region: "Extra-UE (SUA pentru FCM/APNs; mixt pentru Mozilla)",
    extraEU: true,
    transfer: "SCC 2021/914 + DPF (Google, Apple).",
    dpa: "https://policies.google.com/terms (FCM) · https://www.apple.com/legal/internet-services/push-notifications/",
    codeRef: "src/lib/web-push.server.ts",
  },
  {
    name: "RevenueCat, Inc.",
    purpose: "Orchestrare abonamente cross-platform; anulare la ștergerea contului (Art. 17)",
    data: "app_user_id (UUID intern), ID achiziție, status abonament. Fără email, fără PII demografic, fără date de sănătate.",
    sensitive: false,
    region: "Extra-UE (SUA)",
    extraEU: true,
    transfer: "SCC 2021/914 + EU-US DPF.",
    dpa: "https://www.revenuecat.com/dpa/",
    codeRef: "src/lib/revenuecat.server.ts",
  },
  {
    name: "Didit",
    purpose: "Verificare vârstă (18+) prin selfie + estimare AI",
    data: "Selfie capturat în fluxul lor hosted, vendor_data=user_id intern, callback URL. Fără orientare, fără date de sănătate, fără locație precisă, fără mesaje.",
    sensitive: true,
    region: "UE",
    extraEU: false,
    transfer: "Intra-UE.",
    dpa: "https://didit.me/legal/dpa",
    codeRef: "src/lib/age-verification.functions.ts",
  },
  {
    name: "Lovable AI Gateway",
    purpose: "Moderare conținut, generare text (bio assist), embeddings",
    data: "Text trimis explicit la moderare/generare (bio, prompts, mesaje raportate). Niciodată date de sănătate, orientare codificată, sau coordonate.",
    sensitive: false,
    region: "UE/SUA (în funcție de modelul rutat — ex. Google Gemini)",
    extraEU: true,
    transfer: "SCC 2021/914 + DPF pentru sub-procesatori US.",
    dpa: "https://lovable.dev/legal/dpa",
    codeRef: "src/lib/ai.server.ts",
  },
  {
    name: "Cloudflare, Inc.",
    purpose: "Edge runtime (Workers) pentru server functions + CDN asseturi",
    data: "Toate request-urile HTTP/S în tranzit (headere, IP, payload), inclusiv date sensibile spre Supabase/Didit/Google. Procesare in-memory, fără persistență la noi.",
    sensitive: true,
    region: "Extra-UE (edge global, inclusiv SUA)",
    extraEU: true,
    transfer: "SCC 2021/914 + EU-US DPF (Cloudflare certificat).",
    dpa: "https://www.cloudflare.com/cloudflare-customer-dpa/",
    codeRef: "platforma de hosting (Lovable Cloud)",
  },
  {
    name: "ANAF (Agenția Națională de Administrare Fiscală)",
    purpose: "Lookup CUI pentru conturi business (validare TVA/identitate fiscală)",
    data: "Doar CUI introdus de business owner. Niciun PII personal.",
    sensitive: false,
    region: "RO",
    extraEU: false,
    transfer: "Intra-RO/UE (autoritate publică).",
    dpa: "https://www.anaf.ro (operator independent — nu procesator)",
    codeRef: "src/lib/anaf.functions.ts",
  },
  {
    name: "OpenStreetMap Foundation",
    purpose:
      "Tile-uri raster pentru harta din feature-ul „Aproape de tine” (descoperire localuri/evenimente/oferte).",
    data: "IP-ul dispozitivului și bounding box-ul tile-urilor cerute. Fără PII, fără cont, fără date Art. 9. NU primește coordonatele exacte ale userului — harta cere doar tile-uri pe zona vizualizată.",
    sensitive: false,
    region: "UK (UE adequacy)",
    extraEU: true,
    transfer: "UK adequacy decision (EC 2021/1772).",
    dpa: "https://wiki.osmfoundation.org/wiki/Privacy_Policy",
    codeRef: "src/components/nearby/NearbyMap.tsx (MapLibre GL + tile.openstreetmap.org)",
  },
];

function SubsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Subprocesatori</h1>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 26 iunie 2026</p>
        <p className="mt-4">
          Conform GDPR Art. 28, mai jos sunt toți împuterniciții reali către care aplicația trimite
          date personale. Lista reflectă codul efectiv (fișierul sursă e indicat la fiecare rând).
          Toți au DPA semnat / sunt acoperiți de un DPA platformă; pentru transferurile în afara SEE
          folosim Clauzele Contractuale Standard ale Comisiei Europene (Decizia 2021/914) și, unde
          există, EU-US Data Privacy Framework.
        </p>

        <p className="mt-3 text-xs text-muted-foreground">
          Bază de date principală găzduită în UE (Frankfurt). Coordonatele precise de locație nu
          părăsesc niciodată baza noastră — către alți useri sau procesatori se trimite doar
          distanță bucketizată.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">Furnizor</th>
                <th className="px-3 py-2 text-left">Scop</th>
                <th className="px-3 py-2 text-left">Categorii de date</th>
                <th className="px-3 py-2 text-left">Regiune</th>
                <th className="px-3 py-2 text-left">Bază transfer</th>
                <th className="px-3 py-2 text-left">DPA</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.name} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">
                    {r.name}
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {r.codeRef}
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.purpose}</td>
                  <td className="px-3 py-2">
                    {r.sensitive && (
                      <span className="mr-1 rounded bg-destructive/15 px-1 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                        Art. 9
                      </span>
                    )}
                    {r.data}
                  </td>
                  <td className="px-3 py-2">
                    {r.extraEU ? (
                      <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                        Extra-UE
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">
                        UE/SEE
                      </span>
                    )}
                    <div className="mt-1 text-[11px] text-muted-foreground">{r.region}</div>
                  </td>
                  <td className="px-3 py-2 text-[11px]">{r.transfer}</td>
                  <td className="px-3 py-2">
                    <a
                      className="text-primary underline"
                      href={r.dpa}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Document
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-base font-semibold">Minimizarea datelor</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>
            <strong>Didit</strong> primește doar selfie + ID intern pentru age check — niciodată
            orientare, date de sănătate sau locație.
          </li>
          <li>
            <strong>RevenueCat</strong> și <strong>Google Play Billing</strong> primesc doar
            identificatorul abonamentului + UUID intern — fără email, fără PII demografic.
          </li>
          <li>
            <strong>Push services</strong> (FCM/APNs/Mozilla) primesc endpoint + un payload scurt
            fără date sensibile (ex. „Ai un mesaj nou”).
          </li>
          <li>
            <strong>AI Gateway</strong> primește doar textul trimis explicit la moderare/generare —
            nu profilul integral.
          </li>
          <li>
            <strong>Coordonatele GPS</strong> nu părăsesc niciodată baza de date; ce iese e bucket
            de distanță.
          </li>
        </ul>

        <p className="mt-6 text-xs text-muted-foreground">
          Modificările listei sunt anunțate cu minim 30 de zile înainte. Poți obiecta la{" "}
          <a className="text-primary" href="mailto:dpo@ventuza.app">
            dpo@ventuza.app
          </a>
          .
        </p>
      </article>
    </div>
  );
}
