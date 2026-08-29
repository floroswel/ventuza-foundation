import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, FileBarChart } from "lucide-react";

export const Route = createFileRoute("/legal/transparency-report")({
  ssr: true,
  head: () => ({
    meta: [
      { title: "Raport de transparență — Suzeta (DSA)" },
      {
        name: "description",
        content:
          "Raportul anual de transparență Suzeta conform Regulamentului UE 2022/2065 (DSA): raportări primite, măsuri luate, termene de răspuns și contestații.",
      },
      { property: "og:title", content: "Raport de transparență — Suzeta" },
      {
        property: "og:description",
        content: "Raportări, măsuri de moderare, termene și contestații — publicate anual (DSA).",
      },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/legal/transparency-report" }],
  }),
  component: TransparencyReport,
});

function TransparencyReport() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        to="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Înapoi
      </Link>

      <header className="mb-6">
        <FileBarChart className="size-8 text-primary" />
        <h1 className="mt-2 text-2xl font-semibold">Raport de transparență</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publicat conform art. 15 din Regulamentul (UE) 2022/2065 privind serviciile digitale
          (DSA). Perioada de raportare: an calendaristic. Cifrele exacte se publică la finalul
          fiecărui an de operare.
        </p>
      </header>

      <Section title="1. Angajamente de termen (SLA)">
        <ul className="list-disc space-y-1 pl-5">
          <li>Raportări cu risc pentru minori sau CSAM: analiză imediată, sub 1 oră.</li>
          <li>Hărțuire, amenințări, conținut sexual neconsimțit: sub 24 de ore.</li>
          <li>Spam, profil fals, conținut nepotrivit: sub 72 de ore.</li>
          <li>Fiecare raportor primește o notificare în aplicație după analiză.</li>
        </ul>
      </Section>

      <Section title="2. Categorii de măsuri aplicate">
        <ul className="list-disc space-y-1 pl-5">
          <li>Eliminare conținut (fotografie, mesaj, anunț partener).</li>
          <li>Avertisment (strike) cu istoric în contul utilizatorului.</li>
          <li>Suspendare temporară sau permanentă a contului.</li>
          <li>Escaladare către autorități pentru conținut ilegal.</li>
        </ul>
      </Section>

      <Section title="3. Contestații">
        <p>
          Orice măsură poate fi contestată din aplicație. Contestațiile sunt analizate de o
          persoană diferită de cea care a luat decizia inițială, în maximum 14 zile.
        </p>
      </Section>

      <Section title="4. Moderare automată">
        <p>
          Folosim clasificare automată pentru nuditate, CSAM (potrivire de hash) și tipare de
          fraudă. Nicio suspendare permanentă nu se aplică exclusiv automat — există întotdeauna
          verificare umană înainte de măsura finală.
        </p>
      </Section>

      <Section title="5. Punct unic de contact">
        <p>
          Autorități și utilizatori:{" "}
          <a className="underline" href="mailto:legal@suzeta.ro">
            legal@suzeta.ro
          </a>
          . Detalii procedurale în{" "}
          <Link to="/legal/dsa" className="underline">
            pagina DSA
          </Link>
          .
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
