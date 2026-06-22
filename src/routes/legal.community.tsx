import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/community")({
  head: () => ({
    meta: [
      { title: "Reguli comunitate — Ventuza" },
      { name: "description", content: "Cum ne purtăm pe Ventuza. Reguli clare, consecințe clare." },
    ],
    links: [{ rel: "canonical", href: "https://ventuza-foundation.lovable.app/legal/community" }],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Reguli comunitate</h1>
      </header>
      <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 22 iunie 2026</p>

        <h2 className="mt-6 text-base font-semibold">Valorile noastre</h2>
        <p>Ventuza este un spațiu pentru comunitatea LGBTQ+ din România. Aici cauți conexiuni, prietenii, întâlniri sau iubire. Tratează-i pe ceilalți așa cum ai vrea să fii tratat: cu respect, onestitate și grijă.</p>

        <h2 className="mt-6 text-base font-semibold">Ce este interzis</h2>
        <ul className="list-disc pl-5">
          <li><strong>Discriminare și ură</strong> — homofobie, transfobie, rasism, antisemitism, islamofobie, capacitism, sexism. Inclusiv în filtrele de profil ("no fats, no fems, no asians" = discriminare).</li>
          <li><strong>Outing</strong> — dezvăluirea identității LGBTQ+ a altcuiva fără consimțământ. Zero toleranță.</li>
          <li><strong>Minori</strong> — orice conținut cu persoane sub 18 ani. Raportăm la NCMEC și autorități.</li>
          <li><strong>Nuditate neconsensuală</strong> — trimiterea de fotografii intime fără cerere. Folosim AI pentru detecție automată.</li>
          <li><strong>Hărțuire și amenințări</strong> — inclusiv stalking, sextortion, doxxing.</li>
          <li><strong>Scam și prostituție</strong> — solicitări de bani, cripto, IBAN, "investiții", escort.</li>
          <li><strong>Impersonare</strong> — fotografii care nu îți aparțin, identitate falsă.</li>
          <li><strong>Spam și comercial</strong> — promovare neautorizată, link-uri suspecte.</li>
          <li><strong>Conținut ilegal</strong> — droguri, arme, trafic de persoane, conținut terorist.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">Consecințe</h2>
        <ul className="list-disc pl-5">
          <li>Avertisment + ștergere conținut.</li>
          <li>Suspendare temporară.</li>
          <li>Ban permanent + raportare la autorități pentru fapte penale.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">Drept de contestare (DSA Art. 20)</h2>
        <p>Dacă ți s-a restricționat contul sau conținutul, primești o notificare cu motivul și ai la dispoziție <strong>14 zile</strong> să contești decizia răspunzând email-ului sau scriindu-ne la <a className="text-primary" href="mailto:appeals@ventuza.app">appeals@ventuza.app</a>. O persoană umană (nu un algoritm) revizuiește contestația în maximum 7 zile.</p>

        <h2 className="mt-6 text-base font-semibold">Raportare</h2>
        <p>Folosește butonul de raportare pe orice profil sau mesaj. Pentru abuz grav: <a className="text-primary" href="mailto:trust@ventuza.app">trust@ventuza.app</a>. Pentru CSAM (conținut cu minori): raportăm direct la <a className="text-primary" href="https://safernet.ro" target="_blank" rel="noreferrer">safernet.ro</a> și INHOPE.</p>

        <h2 className="mt-6 text-base font-semibold">Resurse</h2>
        <p>ACCEPT România — <a className="text-primary" href="tel:+40215635209">021 563 52 09</a> · Helpline anti-violență <a className="text-primary" href="tel:0800500333">0800 500 333</a>.</p>
      </article>
    </div>
  );
}
