import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Handshake, ShieldCheck, Store, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/support-us")({
  ssr: true,
  head: () => ({
    meta: [
      { title: "Susține Suzeta — gratuită mereu, susținută de comunitate" },
      {
        name: "description",
        content:
          "Suzeta rămâne gratuită pentru utilizatori. Costurile sunt acoperite de parteneri locali și de sprijinul comunității. Vezi cum poți ajuta.",
      },
      { property: "og:title", content: "Susține Suzeta" },
      {
        property: "og:description",
        content: "Fără paywall, fără reclame agresive. Susținută de comunitate și parteneri locali.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://suzeta.app/support-us" }],
  }),
  component: SupportUs,
});

function SupportUs() {
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Link
        to="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Înapoi
      </Link>

      <header className="mb-6">
        <Heart className="size-8 text-primary" />
        <h1 className="mt-2 text-2xl font-semibold">Susține Suzeta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suzeta e gratuită și rămâne gratuită. Fără paywall pe mesaje, fără limitări artificiale.
          Costurile (servere, moderare, verificare 18+) sunt acoperite din parteneriate locale și
          din sprijinul comunității.
        </p>
      </header>

      <section className="space-y-3">
        <Card
          icon={<Handshake className="size-4" />}
          title="Adu un partener local"
          body="Un bar, o cafenea sau un organizator de evenimente din orașul tău poate apărea în hartă și în evenimente. Portalul de parteneri e deschis, prețurile se anunță în curând."
          to="/partner"
          cta="Vezi portalul de parteneri"
        />
        <Card
          icon={<Store className="size-4" />}
          title="Merch în portofel"
          body="Produsele din portofel finanțează direct costurile de infrastructură. Fiecare comandă ține aplicația gratuită pentru toți."
          to="/wallet"
          cta="Deschide portofelul"
        />
        <Card
          icon={<Heart className="size-4" />}
          title="Invită oameni din orașul tău"
          body="Cel mai valoros sprijin e densitatea. O aplicație plină în orașul tău e mai utilă decât orice donație."
          to="/invite"
          cta="Invită prieteni"
        />
        <Card
          icon={<ShieldCheck className="size-4" />}
          title="Raportează ce nu e în regulă"
          body="Moderarea funcționează pentru că oamenii semnalează. Fiecare raportare primește răspuns după analiză."
          to="/safety"
          cta="Centrul de siguranță"
        />
      </section>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        Nu vindem date personale și nu folosim date sensibile (orientare, sănătate, locație precisă)
        în scopuri publicitare. Detalii în{" "}
        <Link to="/legal/privacy" className="underline">
          politica de confidențialitate
        </Link>
        .
      </p>
    </main>
  );
}

function Card({
  icon,
  title,
  body,
  to,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="rounded-full bg-primary/10 p-1.5 text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      <Link to={to} className="mt-2 inline-block text-xs font-medium text-primary underline">
        {cta}
      </Link>
    </div>
  );
}
