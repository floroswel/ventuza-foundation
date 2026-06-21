import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Eye, MessageCircle, MapPin, Phone, AlertTriangle, ChevronLeft } from "lucide-react";
import { PanicToolsCard } from "@/components/PanicToolsCard";
import { HealthReminderCard } from "@/components/HealthReminderCard";


export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Centrul de siguranță — Ventuza" },
      { name: "description", content: "Sfaturi de siguranță, resurse de urgență și instrumente pentru a-ți proteja experiența pe Ventuza." },
    ],
  }),
  component: SafetyCenter,
});

function SafetyCenter() {
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Link to="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Înapoi
      </Link>
      <header className="mb-6">
        <Shield className="size-8 text-primary" />
        <h1 className="mt-2 text-2xl font-semibold">Centrul de siguranță</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Siguranța ta este pe primul loc. Iată cum o protejăm — și cum o poți proteja tu.
        </p>
      </header>

      <section className="space-y-4">
        <Tip icon={<Eye />} title="Verifică profilul" body="Cere o poză spontană sau un video-apel scurt înainte să te întâlnești. Pozele furate sunt cel mai comun semn de scam." />
        <Tip icon={<MapPin />} title="Prima întâlnire — loc public" body="Cafenea, restaurant, parc cu lume. Spune-i unui prieten unde mergi și cu cine. Trimite-i locația ta live." />
        <Tip icon={<MessageCircle />} title="Rămâi în Ventuza" body="Nu trece pe alte aplicații imediat. Aici comunicarea e protejată; raportarea funcționează rapid." />
        <Tip icon={<AlertTriangle />} title="Niciodată bani sau date bancare" body="Dacă cineva îți cere bani, IBAN, criptomonede, sau să-i finanțezi „o urgență” — e scam. Raportează imediat." />

        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Phone className="size-4" /> Numere de urgență (România)
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a href="tel:112" className="font-mono font-semibold">112</a> — Urgențe (poliție, ambulanță)</li>
            <li><a href="tel:0800500333" className="font-mono">0800 500 333</a> — Linia pentru victimele violenței</li>
            <li><a href="tel:116123" className="font-mono">116 123</a> — Telefonul de criză (suport emoțional)</li>
            <li><a href="https://www.accept-romania.ro" target="_blank" rel="noreferrer" className="underline">ACCEPT</a> — Suport LGBTQ+ România</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Sănătate sexuală</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Testarea regulată (HIV, ITS) este parte din grijă, nu rușine. PrEP, PEP și TasP sunt opțiuni reale.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>• <a href="https://www.arasnet.ro" target="_blank" rel="noreferrer" className="underline">ARAS</a> — Testare gratuită + counseling</li>
            <li>• <a href="https://sensiblu.com" target="_blank" rel="noreferrer" className="underline">Sensiblu</a> — Teste rapide HIV/ITS</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Ai fost hărțuit sau te simți în pericol?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Folosește butonul „Raportează” din fiecare profil sau chat. Echipa noastră analizează în maxim 24h.
            Conturile cu 3+ rapoarte sunt revizuite automat.
          </p>
        </div>
      </section>
    </main>
  );
}

function Tip({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary [&>svg]:size-4">{icon}</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}
