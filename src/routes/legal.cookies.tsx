import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { LegalDocOverride } from "@/components/legal/LegalDocOverride";
import { OPERATOR, OperatorIdentificationBlock } from "@/components/legal/OperatorInfo";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Politica de cookie-uri — Ventuza" },
      {
        name: "description",
        content: "Ce cookie-uri folosim, de ce și cum îți poți retrage consimțământul.",
      },
    ],
    links: [{ rel: "canonical", href: "https://ventuza.app/legal/cookies" }],
  }),
  component: CookiesPage,
});

type CookieRow = {
  name: string;
  category: "Esențial" | "Preferință" | "Analytics" | "Marketing";
  party: "First-party" | "Third-party";
  storage: "Cookie" | "localStorage" | "sessionStorage";
  duration: string;
  purpose: string;
};

const COOKIES: CookieRow[] = [
  {
    name: "sb-<project>-auth-token",
    category: "Esențial",
    party: "First-party",
    storage: "localStorage",
    duration: "Până la logout / expirare (≤7 zile)",
    purpose: "Sesiune de autentificare Supabase (JWT). Fără el nu poți fi logat.",
  },
  {
    name: "ventuza_cookie_consent_v2",
    category: "Esențial",
    party: "First-party",
    storage: "localStorage",
    duration: "12 luni",
    purpose: "Reține alegerile tale privind cookie-urile (esențial pentru a respecta GDPR).",
  },
  {
    name: "vz_discreet_mode",
    category: "Preferință",
    party: "First-party",
    storage: "localStorage",
    duration: "Persistent (până schimbi tu)",
    purpose: "Modul discret ales (icon/nume aplicație camuflate).",
  },
  {
    name: "vz_pin_lock",
    category: "Esențial",
    party: "First-party",
    storage: "localStorage",
    duration: "Persistent (până dezactivezi PIN-ul)",
    purpose: "Hash PIN local pentru blocarea aplicației (nu părăsește dispozitivul).",
  },
  {
    name: "vz_notification_sound",
    category: "Preferință",
    party: "First-party",
    storage: "localStorage",
    duration: "Persistent",
    purpose: "Preferința ta pentru sunetul notificărilor.",
  },
  {
    name: "vz_saved_views",
    category: "Preferință",
    party: "First-party",
    storage: "localStorage",
    duration: "Persistent",
    purpose: "Filtre salvate în Discover / Admin.",
  },
  {
    name: "cf_clearance",
    category: "Esențial",
    party: "Third-party",
    storage: "Cookie",
    duration: "Sesiune / max 30 zile",
    purpose: "Cloudflare — protecție anti-bot / challenge de securitate.",
  },
];

function CookiesPage() {
  function reopen() {
    try {
      localStorage.removeItem("ventuza_cookie_consent_v2");
      location.reload();
    } catch {}
  }
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Politica de cookie-uri</h1>
      </header>
      <LegalDocOverride
        slug="cookies"
        fallback={
          <article className="prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed">
            <p className="text-xs text-muted-foreground">Ultima actualizare: 5 iulie 2026</p>
            <h2 className="mt-6 text-base font-semibold">1. Ce sunt cookie-urile</h2>
            <p>
              Fișiere mici stocate de browser/dispozitiv (cookies HTTP, localStorage,
              sessionStorage). Le folosim pentru a funcționa, a-ți reține preferințele și, dacă
              accepți, pentru a analiza utilizarea aplicației.
            </p>

            <h2 className="mt-6 text-base font-semibold">2. Categorii</h2>
            <ul className="list-disc pl-5">
              <li>
                <strong>Esențiale</strong> (always-on): autentificare, sesiune, CSRF, preferințe
                siguranță. Bază legală: <em>interes legitim</em> și <em>execuția contractului</em>.
              </li>
              <li>
                <strong>Preferință</strong> (always-on): rețin alegeri UX pe care ai făcut TU (mod
                discret, PIN, filtre salvate). Bază legală: <em>execuția contractului</em>.
              </li>
              <li>
                <strong>Analytics</strong> (opt-in): măsurători anonime de utilizare. Bază legală:{" "}
                <em>consimțământ</em>. Aplicația NU folosește actualmente analytics third-party.
              </li>
              <li>
                <strong>Marketing</strong> (opt-in): atribuire campanii, recomandări. Bază legală:{" "}
                <em>consimțământ</em>. NU folosim cookie-uri de marketing third-party.
              </li>
            </ul>

            <h2 className="mt-6 text-base font-semibold">3. Lista exactă de cookie-uri folosite</h2>
            <p className="mt-2">
              Lista de mai jos reflectă cookie-urile și entry-urile de localStorage pe care le
              setează aplicația efectiv. Nu folosim tracking pixels, nu folosim Google Analytics,
              Meta Pixel sau alte SDK-uri de măsurare terțe.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-3 py-2 text-left">Nume</th>
                    <th className="px-3 py-2 text-left">Categorie</th>
                    <th className="px-3 py-2 text-left">First / Third</th>
                    <th className="px-3 py-2 text-left">Tip</th>
                    <th className="px-3 py-2 text-left">Durată</th>
                    <th className="px-3 py-2 text-left">Scop</th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIES.map((c) => (
                    <tr key={c.name} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-mono text-[11px]">{c.name}</td>
                      <td className="px-3 py-2">{c.category}</td>
                      <td className="px-3 py-2">{c.party}</td>
                      <td className="px-3 py-2">{c.storage}</td>
                      <td className="px-3 py-2">{c.duration}</td>
                      <td className="px-3 py-2">{c.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-6 text-base font-semibold">
              4. Cum îți gestionezi consimțământul
            </h2>
            <p>Poți schimba alegerile oricând:</p>
            <button
              onClick={reopen}
              className="mt-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              Redeschide setările cookie-uri
            </button>

            <h2 className="mt-6 text-base font-semibold">5. Reține</h2>
            <p>
              Cookie-urile esențiale nu pot fi dezactivate — fără ele aplicația nu funcționează.
              Pentru analytics și marketing, refuzul nu îți afectează accesul la funcționalități.
            </p>

            <h2 className="mt-6 text-base font-semibold">6. Operator și contact</h2>
            <div className="mt-2">
              <OperatorIdentificationBlock compact />
            </div>
            <p className="mt-3">
              Întrebări:{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.privacy}`}>
                {OPERATOR.emails.privacy}
              </a>{" "}
              · DPO:{" "}
              <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
                {OPERATOR.emails.dpo}
              </a>
              .
            </p>
          </article>
        }
      />
    </div>
  );
}
