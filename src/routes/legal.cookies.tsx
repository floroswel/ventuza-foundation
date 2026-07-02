import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Politica de cookie-uri — Ventuza" },
      { name: "description", content: "Ce cookie-uri folosim, de ce și cum îți poți retrage consimțământul." },
    ],
    links: [{ rel: "canonical", href: "https://ventuza-foundation.lovable.app/legal/cookies" }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  function reopen() {
    try {
      localStorage.removeItem("ventuza_cookie_consent_v2");
      location.reload();
    } catch {}
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Politica de cookie-uri</h1>
      </header>
      <LegalDocOverride slug="cookies" fallback={<article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Ultima actualizare: 22 iunie 2026</p>
        <h2 className="mt-6 text-base font-semibold">1. Ce sunt cookie-urile</h2>
        <p>Fișiere mici stocate de browser/dispozitiv. Le folosim pentru a funcționa, a analiza utilizarea și a îmbunătăți aplicația.</p>

        <h2 className="mt-6 text-base font-semibold">2. Categorii</h2>
        <ul className="list-disc pl-5">
          <li><strong>Esențiale</strong> (always-on): autentificare, sesiune, CSRF, preferințe siguranță. Bază legală: <em>interes legitim</em> și <em>execuția contractului</em>.</li>
          <li><strong>Analytics</strong> (opt-in): măsurători anonime de utilizare. Bază legală: <em>consimțământ</em>.</li>
          <li><strong>Marketing</strong> (opt-in): atribuire campanii, recomandări. Bază legală: <em>consimțământ</em>.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold">3. Cum îți gestionezi consimțământul</h2>
        <p>Poți schimba alegerile oricând:</p>
        <button onClick={reopen} className="mt-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
          Redeschide setările cookie-uri
        </button>

        <h2 className="mt-6 text-base font-semibold">4. Reține</h2>
        <p>Cookie-urile esențiale nu pot fi dezactivate — fără ele aplicația nu funcționează. Pentru analytics și marketing, refuzul nu îți afectează accesul la funcționalități.</p>

        <h2 className="mt-6 text-base font-semibold">5. Contact</h2>
        <p>Întrebări: <a className="text-primary" href="mailto:privacy@ventuza.app">privacy@ventuza.app</a> · DPO: <a className="text-primary" href="mailto:dpo@ventuza.app">dpo@ventuza.app</a>.</p>
      </article>} />
    </div>
  );
}
