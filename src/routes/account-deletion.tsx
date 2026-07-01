import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, Mail, Shield, Clock } from "lucide-react";

export const Route = createFileRoute("/account-deletion")({
  head: () => ({
    meta: [
      { title: "Ștergere cont — Ventuza" },
      {
        name: "description",
        content:
          "Cum îți ștergi contul Ventuza și ce date sunt eliminate sau păstrate, conform GDPR. Cerere prin aplicație sau email la dpo@ventuza.eu.",
      },
      { property: "og:title", content: "Ștergere cont — Ventuza" },
      {
        property: "og:description",
        content: "Procedura completă de ștergere a contului și a datelor personale în Ventuza.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: AccountDeletionPage,
});

function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <Trash2 className="size-3.5" /> GDPR Art. 17 — Dreptul la ștergere
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Ștergere cont Ventuza</h1>
          <p className="text-muted-foreground">
            Îți poți șterge contul oricând, gratuit, fără justificare. Mai jos găsești cele două
            metode disponibile, ce date eliminăm imediat și ce date păstrăm pentru obligații
            legale.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="size-5 text-primary" /> Metoda 1 — Din aplicație (recomandat)
          </h2>
          <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
            <li>Autentifică-te în aplicație.</li>
            <li>
              Mergi la <strong className="text-foreground">Setări → Cont → Șterge contul</strong>{" "}
              (sau accesează direct{" "}
              <Link to="/settings" className="text-primary underline">
                /settings
              </Link>
              ).
            </li>
            <li>Confirmă cererea. Contul intră în perioadă de grație de 14 zile.</li>
            <li>După 14 zile, datele sunt șterse definitiv conform listei de mai jos.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Mail className="size-5 text-primary" /> Metoda 2 — Prin email
          </h2>
          <p className="text-sm text-muted-foreground">
            Trimite o cerere de la adresa de email asociată contului tău la:
          </p>
          <a
            href="mailto:dpo@ventuza.eu?subject=Cerere%20%C8%99tergere%20cont%20Ventuza"
            className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            dpo@ventuza.eu
          </a>
          <p className="text-xs text-muted-foreground">
            Răspundem în maximum 30 de zile (Art. 12 GDPR). Pentru verificarea identității putem
            cere confirmarea unui cod trimis la emailul contului.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">Ce date ștergem</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
            <li>Profilul tău (nume, fotografii, bio, preferințe, orientare, locație).</li>
            <li>Consimțăminte și log-uri asociate contului tău.</li>
            <li>Mesaje trimise și primite, swipe-uri, match-uri, vizualizări.</li>
            <li>Album privat, stories, voice notes, video clips.</li>
            <li>Notificări push, abonamente premium și istoric grant-uri.</li>
            <li>Token-uri de autentificare și sesiuni active.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="size-5 text-amber-500" /> Ce păstrăm și de ce
          </h2>
          <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Facturi B2B</strong> — 10 ani (Cod Fiscal RO,
              Art. 25 Legea Contabilității). Doar pentru conturi de partener.
            </li>
            <li>
              <strong className="text-foreground">Loguri de moderare și abuse</strong> — 12 luni,
              anonimizate, pentru siguranța comunității.
            </li>
            <li>
              <strong className="text-foreground">Hash-uri CSAM</strong> — permanent (obligație
              legală raportare NCMEC / ANPDCP).
            </li>
            <li>
              <strong className="text-foreground">Rapoarte DSA</strong> — anonimizate, 6 luni
              (Art. 24 DSA).
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6 space-y-2">
          <h2 className="text-xl font-semibold">Operator de date</h2>
          <p className="text-sm text-muted-foreground">
            VOMIX GENIUS S.R.L. · CUI RO43025661 · Str. Constructorilor 39, Voievoda, Teleorman
            <br />
            DPO: <a className="text-primary underline" href="mailto:dpo@ventuza.eu">dpo@ventuza.eu</a>
            {" · "}
            Privacy:{" "}
            <Link to="/legal/privacy" className="text-primary underline">
              /legal/privacy
            </Link>
          </p>
        </section>

        <footer className="text-center text-xs text-muted-foreground pt-4">
          <Link to="/" className="underline">
            Înapoi la Ventuza
          </Link>
        </footer>
      </div>
    </main>
  );
}
