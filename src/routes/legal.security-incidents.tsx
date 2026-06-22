import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/security-incidents")({
  head: () => ({
    meta: [
      { title: "Procedură incidente de securitate — Ventuza" },
      { name: "description", content: "Cum gestionăm și notificăm breșele de securitate conform GDPR Art. 33-34." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Incidente de securitate</h1>
      </header>

      <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Procedură conform GDPR Art. 33-34 · Ultima actualizare: 22 iunie 2026</p>

        <h2 className="mt-6 text-base font-semibold">1. Ce considerăm incident</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
          <li>Acces neautorizat la baza de date sau la fotografii private.</li>
          <li>Scurgere de date cu caracter personal (email, locație, status HIV, mesaje).</li>
          <li>Compromiterea conturilor de administrator sau a cheilor service-role.</li>
          <li>Atac DDoS sau ransomware care afectează disponibilitatea.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">2. Detectare</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
          <li>Monitoring continuu al logs de autentificare și rate-limit.</li>
          <li>Alerte automate pentru queries anormale și escaladări de privilegii.</li>
          <li>Raportare comunitate la <a className="text-primary" href="mailto:security@ventuza.app">security@ventuza.app</a>.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">3. Răspuns (în primele 24h)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/85">
          <li>Izolare: blocarea vectorului (rotație chei, dezactivare cont compromis).</li>
          <li>Evaluare impact: ce date, câți utilizatori, sensibilitate.</li>
          <li>Documentare în registrul intern de incidente.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold">4. Notificare ANSPDCP (Art. 33)</h2>
        <p className="mt-2 text-foreground/85">
          Notificăm Autoritatea Națională de Supraveghere a Prelucrării Datelor (ANSPDCP) în maximum <strong>72 de ore</strong> de
          la descoperire, prin formularul oficial de pe <a className="text-primary" href="https://www.dataprotection.ro" target="_blank" rel="noreferrer">dataprotection.ro</a>.
        </p>

        <h2 className="mt-6 text-base font-semibold">5. Notificare utilizatori (Art. 34)</h2>
        <p className="mt-2 text-foreground/85">
          Dacă incidentul implică risc ridicat pentru drepturile tale, te anunțăm direct prin email și notificare in-app, cu:
          ce date au fost afectate, ce măsuri am luat, ce poți face (schimbare parolă, monitorizare).
        </p>

        <h2 className="mt-6 text-base font-semibold">6. Raportează o vulnerabilitate</h2>
        <p className="mt-2 text-foreground/85">
          Cercetători de securitate: trimite raport responsabil la <a className="text-primary" href="mailto:security@ventuza.app">security@ventuza.app</a>.
          Nu acționăm legal împotriva celor care respectă safe harbor (fără exfiltrare date, fără DoS, fără social engineering).
        </p>
      </article>
    </div>
  );
}
