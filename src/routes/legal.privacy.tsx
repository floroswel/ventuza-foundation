import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Politica de confidențialitate — Ventuza" },
      { name: "description", content: "Cum colectăm, folosim și protejăm datele tale personale în Ventuza." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Politica de confidențialitate</h1>
      </header>

      <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 20 iunie 2026</p>

        <p className="mt-4 text-foreground/85">
          Ventuza ("noi") respectă confidențialitatea ta. Acest document explică ce date colectăm, de ce, cu cine le
          împărtășim și ce drepturi ai conform GDPR.
        </p>

        <h2 className="mt-6 text-base font-semibold">1. Date pe care le colectăm</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
          <li><strong>Cont:</strong> email, parolă hash-uită, data nașterii.</li>
          <li><strong>Profil:</strong> nume afișat, fotografii, descriere, interese, gen, orientare, oraș.</li>
          <li><strong>Date de sănătate (opționale):</strong> status HIV, data ultimului test — date sensibile Art. 9 GDPR.</li>
          <li><strong>Locație:</strong> aproximativă (oraș) pentru match-uri în zonă; nu stocăm coordonate GPS precise în istoric.</li>
          <li><strong>Activitate:</strong> swipe-uri, match-uri, mesaje, RSVP la evenimente.</li>
          <li><strong>Tehnice:</strong> IP, tip dispozitiv, OS, identificator de notificări push.</li>
          <li><strong>Plăți Premium:</strong> token-ul tranzacției Google Play (nu vedem numărul cardului).</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">2. Temei legal (GDPR Art. 6 și 9)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
          <li><strong>Execuția contractului</strong> — pentru a furniza serviciul.</li>
          <li><strong>Consimțământ explicit</strong> — pentru datele de sănătate (status HIV) și notificările marketing.</li>
          <li><strong>Interes legitim</strong> — moderare, prevenirea fraudei, securitate.</li>
          <li><strong>Obligație legală</strong> — răspuns la solicitări ale autorităților.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">3. Cu cine împărtășim datele</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
          <li><strong>Alți utilizatori</strong> — profilul tău public (fotografii, bio, interese, status HIV dacă l-ai completat).</li>
          <li><strong>Subprocesatori:</strong>
            <ul className="mt-1 list-[circle] pl-5">
              <li>Supabase (Lovable Cloud) — bază de date, autentificare, stocare fotografii (UE).</li>
              <li>Google Cloud — moderare AI a fotografiilor.</li>
              <li>Google Play Billing — procesare plăți Premium.</li>
              <li>Furnizor email tranzacțional — confirmări cont și resetare parolă.</li>
            </ul>
          </li>
          <li>NU vindem datele tale către terți pentru publicitate.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">4. Perioade de retenție</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
          <li><strong>Profil activ</strong> — pe durata existenței contului.</li>
          <li><strong>După ștergere</strong> — eliminare definitivă în maximum 30 de zile (backup-uri rotite în 90 zile).</li>
          <li><strong>Conturi inactive</strong> {">"} 24 luni — anonimizate automat (email și fotografii șterse).</li>
          <li><strong>Mesaje private</strong> — păstrate cât există conversația; ștergerea contului le elimină.</li>
          <li><strong>SOS events (locație panică)</strong> — 12 luni, apoi anonimizate.</li>
          <li><strong>Logs autentificare și rate-limit</strong> — 90 de zile (interes legitim, securitate).</li>
          <li><strong>Rapoarte abuz și moderare</strong> — 24 luni (obligație legală DSA).</li>
          <li><strong>Facturi Premium și advertiseri</strong> — 10 ani (obligație fiscală RO).</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">4.1. Contact DSA (Digital Services Act)</h2>
        <p className="mt-2 text-foreground/85">
          Punct unic de contact pentru autorități și utilizatori conform DSA Art. 11-12:
          <a className="text-primary" href="mailto:dsa@ventuza.app"> dsa@ventuza.app</a>. Răspundem în limba română și engleză.
          Vezi și <Link className="text-primary" to="/legal/dsa">pagina DSA dedicată</Link>.
        </p>

        <h2 className="mt-6 text-base font-semibold">5. Drepturile tale GDPR</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
          <li><strong>Acces</strong> — copie a datelor tale (cerere la support@ventuza.app, răspuns în 30 de zile).</li>
          <li><strong>Rectificare</strong> — corectează direct din profil.</li>
          <li><strong>Ștergere</strong> — direct din <em>Setări → Șterge cont</em>.</li>
          <li><strong>Portabilitate</strong> — export JSON la cerere.</li>
          <li><strong>Opoziție</strong> — retrage consimțământul pentru marketing din setări.</li>
          <li><strong>Reclamație</strong> — la ANSPDCP (<a className="text-primary" href="https://www.dataprotection.ro" target="_blank" rel="noreferrer">dataprotection.ro</a>).</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">6. Securitate</h2>
        <p className="mt-2 text-foreground/85">
          Folosim TLS pentru toate conexiunile, Row Level Security pentru izolarea datelor între utilizatori, parole
          hash-uite cu bcrypt, fotografii stocate în bucket-uri private cu URL-uri semnate temporar. Moderare AI a
          fotografiilor înainte de publicare.
        </p>

        <h2 className="mt-6 text-base font-semibold">7. Cookies</h2>
        <p className="mt-2 text-foreground/85">
          Folosim doar cookies tehnice esențiale (sesiune autentificare). Nu folosim cookies de tracking sau publicitate.
        </p>

        <h2 className="mt-6 text-base font-semibold">8. Minori</h2>
        <p className="mt-2 text-foreground/85">
          Aplicația este interzisă sub 18 ani. Verificăm vârsta prin data nașterii la onboarding. Dacă descoperim un cont
          minor, îl ștergem imediat. Raportează suspiciuni la <a className="text-primary" href="mailto:abuse@ventuza.app">abuse@ventuza.app</a>.
        </p>

        <h2 className="mt-6 text-base font-semibold">9. Transferuri internaționale</h2>
        <p className="mt-2 text-foreground/85">
          Datele sunt stocate în UE. Subprocesatorii din afara UE (ex: Google Cloud) operează sub Clauze Contractuale
          Standard ale Comisiei Europene.
        </p>

        <h2 className="mt-6 text-base font-semibold">10. Operator de date</h2>
        <p className="mt-2 text-foreground/85">
          Operator: <strong>Ventuza</strong> · Email DPO: <a className="text-primary" href="mailto:privacy@ventuza.app">privacy@ventuza.app</a>
        </p>
      </article>
    </div>
  );
}
