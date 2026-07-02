import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";

export const Route = createFileRoute("/legal/dsa")({
  head: () => ({
    meta: [
      { title: "Transparență DSA — Ventuza" },
      { name: "description", content: "Raport de transparență și punct unic de contact conform Digital Services Act." },
    ],
    links: [{ rel: "canonical", href: "https://ventuza-foundation.lovable.app/legal/dsa" }],
  }),
  component: DsaPage,
});

function DsaPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Transparență DSA</h1>
      </header>
      <LegalDocOverride slug="dsa" fallback={<article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 22 iunie 2026</p>

        <h2 className="mt-6 text-base font-semibold">Punct unic de contact (DSA Art. 11–12)</h2>
        <ul className="list-disc pl-5">
          <li>Pentru autorități: <a className="text-primary" href="mailto:dsa@ventuza.app">dsa@ventuza.app</a></li>
          <li>Pentru utilizatori: <a className="text-primary" href="mailto:trust@ventuza.app">trust@ventuza.app</a></li>
          <li>Limbi: română, engleză</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">Mecanism notificare conținut ilegal (Art. 16)</h2>
        <p>Orice utilizator sau autoritate poate raporta conținut presupus ilegal prin butonul "Raportează" din aplicație sau prin email la <a className="text-primary" href="mailto:trust@ventuza.app">trust@ventuza.app</a>. Confirmăm primirea în 24h și luăm decizia în maximum 7 zile.</p>

        <h2 className="mt-6 text-base font-semibold">Drept de contestare (Art. 20)</h2>
        <p>Deciziile de moderare pot fi contestate gratuit, intern, în termen de 14 zile, la <a className="text-primary" href="mailto:appeals@ventuza.app">appeals@ventuza.app</a>. Răspuns uman în maximum 7 zile.</p>

        <h2 className="mt-6 text-base font-semibold">Raport de transparență (Art. 15)</h2>
        <p>Publicăm anual statistici despre: numărul de notificări primite, acțiuni întreprinse, conturi suspendate, mediană timp de răspuns. Primul raport va fi publicat la 12 luni de la lansarea publică.</p>

        <h2 className="mt-6 text-base font-semibold">Autoritate coordonatoare DSA în România</h2>
        <p>ANCOM — <a className="text-primary" href="https://www.ancom.ro" target="_blank" rel="noreferrer">ancom.ro</a></p>

        <h2 className="mt-6 text-base font-semibold">Reprezentant legal în UE</h2>
        <p>Ventuza este stabilită în România (UE), deci nu este necesar un reprezentant separat conform DSA Art. 13.</p>
      </article>} />
    </div>
  );
}
