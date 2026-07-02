import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/records-of-processing")({
  head: () => ({
    meta: [
      { title: "Registru Art. 30 GDPR — Ventuza" },
      {
        name: "description",
        content:
          "Sumar public al Registrului activităților de prelucrare ținut intern conform Art. 30 GDPR.",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://ventuza-foundation.lovable.app/legal/records-of-processing",
      },
    ],
  }),
  component: RoPAPage,
});

type Activity = {
  id: string;
  name: string;
  purpose: string;
  art9: boolean;
  legalBasis: string;
  art9Basis: string;
  processors: string;
  retention: string;
};

const ACTIVITIES: Activity[] = [
  {
    id: "A1",
    name: "Gestionare cont și profil",
    purpose: "Creare cont, autentificare, profil, sesiune.",
    art9: true,
    legalBasis: "6(1)(b) contract",
    art9Basis: "9(2)(a) consimțământ explicit (orientare, convingeri)",
    processors: "P1 Supabase, P3 Google OAuth, P8 Cloudflare",
    retention: "Cont activ + 24 luni inactivitate → ștergere automată",
  },
  {
    id: "A2",
    name: "Matching / Discover",
    purpose: "Afișare profile compatibile, swipe/match, filtre.",
    art9: true,
    legalBasis: "6(1)(b) contract",
    art9Basis: "9(2)(a) consimțământ explicit",
    processors: "P1, P8",
    retention: "Pe durata contului; profile_views 90 zile",
  },
  {
    id: "A3",
    name: "Mesagerie & media privată",
    purpose: "Conversații 1:1, grupuri, albume private, stories.",
    art9: true,
    legalBasis: "6(1)(b) contract",
    art9Basis: "9(2)(a) consimțământ explicit (conținut user-generated)",
    processors: "P1, P4 push, P8",
    retention: "Cascade la ștergerea contului",
  },
  {
    id: "A4",
    name: "Verificare vârstă (18+) — Didit",
    purpose: "Confirmare vârstă minimă, blocare minori.",
    art9: true,
    legalBasis: "6(1)(c) obligație legală (DSA) + 6(1)(f)",
    art9Basis: "9(2)(a) + 9(2)(g) interes public substanțial (biometric)",
    processors: "P1, P6 Didit, P8",
    retention: "24 luni; selfie șters la deleteMyAccount",
  },
  {
    id: "A5",
    name: "Abonamente Premium",
    purpose: "Vânzare + validare plată + anulare.",
    art9: false,
    legalBasis: "6(1)(b) contract",
    art9Basis: "—",
    processors: "P1, P2 Google Play, P5 RevenueCat, P8",
    retention: "10 ani fiscal (Cod fiscal RO)",
  },
  {
    id: "A6",
    name: "Notificări push",
    purpose: "Anunțuri tranzacționale + Modul Discret.",
    art9: false,
    legalBasis: "6(1)(a) consimțământ + 6(1)(b)",
    art9Basis: "—",
    processors: "P1, P4 FCM/APNs/Mozilla, P8",
    retention: "Cât timp subscription activ",
  },
  {
    id: "A7",
    name: "Raportare conținut ilegal / DSA",
    purpose: "Triaj rapoarte, moderare, blocare.",
    art9: true,
    legalBasis: "6(1)(c) DSA + 6(1)(f)",
    art9Basis: "9(2)(g) interes public substanțial",
    processors: "P1, P7 AI Gateway (opțional), P8",
    retention: "36 luni",
  },
  {
    id: "A8",
    name: "Raportare CSAM",
    purpose: "Detecție + raportare obligatorie.",
    art9: true,
    legalBasis: "6(1)(c) obligație legală",
    art9Basis: "9(2)(g) interes public substanțial",
    processors: "P1, NCMEC, autorități penale",
    retention: "Permanent",
  },
  {
    id: "A9",
    name: "SOS / siguranță",
    purpose: "Panic button, fake call.",
    art9: true,
    legalBasis: "6(1)(b) + 6(1)(d) interese vitale",
    art9Basis: "9(2)(c) interese vitale",
    processors: "P1, P8",
    retention: "12 luni",
  },
  {
    id: "A10",
    name: "Ștergere cont & portabilitate",
    purpose: "Exercitare Art. 15/17/20 GDPR.",
    art9: true,
    legalBasis: "6(1)(c) obligație legală",
    art9Basis: "9(2)(a) consimțământul inițial al persoanei vizate",
    processors: "P1, P5 RevenueCat (anulare), P8",
    retention: "deletion_requests 3 ani",
  },
  {
    id: "A11",
    name: "Evenimente, RSVP, advertising",
    purpose: "Organizare comunitate + sponsored banners.",
    art9: true,
    legalBasis: "6(1)(b) contract",
    art9Basis: "9(2)(e) date făcute publice manifest",
    processors: "P1, P8",
    retention: "Eveniment + 12 luni; ad_events 90 zile",
  },
  {
    id: "A12",
    name: "Business onboarding (ANAF CUI)",
    purpose: "Validare identitate fiscală business.",
    art9: false,
    legalBasis: "6(1)(b) + 6(1)(c)",
    art9Basis: "—",
    processors: "P1, P9 ANAF, P8",
    retention: "10 ani fiscal",
  },
  {
    id: "A13",
    name: "Consimțăminte & probă conformitate",
    purpose: "consent_log, policy_versions.",
    art9: false,
    legalBasis: "6(1)(c) Art. 7(1) GDPR",
    art9Basis: "—",
    processors: "P1, P8",
    retention: "Cont + 3 ani după ștergere",
  },
  {
    id: "A14",
    name: "Securitate, anti-fraudă, audit admin",
    purpose: "Fingerprint, rate-limit, audit log, breach.",
    art9: false,
    legalBasis: "6(1)(f) + 6(1)(c)",
    art9Basis: "—",
    processors: "P1, P8",
    retention: "Audit 24 luni; breach 5 ani",
  },
  {
    id: "A15",
    name: "Marketing direct (opțional)",
    purpose: "Email/push promo Premium.",
    art9: false,
    legalBasis: "6(1)(a) consimțământ",
    art9Basis: "—",
    processors: "P1, P4, P8",
    retention: "Cât consimțământul activ + 12 luni log",
  },
  {
    id: "A16",
    name: "Telemetry & web vitals",
    purpose: "Performanță tehnică anonimă.",
    art9: false,
    legalBasis: "6(1)(f) interes legitim",
    art9Basis: "—",
    processors: "P1, P8",
    retention: "90 zile",
  },
  {
    id: "A17",
    name: "AI features (moderare, bio assist)",
    purpose: "Moderare text, asistent bio, embeddings.",
    art9: true,
    legalBasis: "6(1)(b) opt-in + 6(1)(f) moderare",
    art9Basis: "9(2)(a) prin trimitere voluntară (DE REZOLVAT: disclosure explicit)",
    processors: "P1, P7 AI Gateway, P8",
    retention: "Zero-retention la model",
  },
];

const TODOS = [
  "A4 — consent_log dedicat kind='age_verification' înainte de redirect la Didit.",
  "A17 — disclosure + consent explicit pentru AI features (kind='ai_features').",
  "A6 — log push activate/dezactivate în consent_log (kind='push_notifications').",
  "DPIA formal (Art. 35) — combinație sănătate + orientare + locație + minori.",
  "TIA post-Schrems II pentru toți procesatorii US (P2/P3/P4/P5/P7/P8).",
  "Procesare HIV eliminată complet (coloane dropate, funcții șterse, kind consent scos).",
  "Desemnare DPO oficial (Art. 37) + contact public.",
  "Confirmare DPA semnate pentru Didit, RevenueCat, Lovable (Supabase).",
];

function RoPAPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Registru Art. 30 GDPR</h1>
      </header>
      <article className="mx-auto max-w-4xl px-4 py-6 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">
          Versiune 2.0 · ultima actualizare: 26 iunie 2026
        </p>
        <p className="mt-4">
          Acesta este sumarul public al Registrului activităților de prelucrare ținut intern conform{" "}
          <strong>Art. 30 GDPR</strong>. Documentul complet (cu tabele tehnice, schema DB, măsuri
          organizatorice, mapare procesatori, retenție și temei juridic per activitate) este în repo
          la{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/gdpr-art-30-register.md</code>{" "}
          și se prezintă ANSPDCP la cerere (nu se depune proactiv — obligația dispărut din 2018).
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Activitate</th>
                <th className="px-3 py-2 text-left">Scop</th>
                <th className="px-3 py-2 text-left">Temei Art. 6</th>
                <th className="px-3 py-2 text-left">Temei Art. 9</th>
                <th className="px-3 py-2 text-left">Destinatari</th>
                <th className="px-3 py-2 text-left">Retenție</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITIES.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-mono text-[11px]">{a.id}</td>
                  <td className="px-3 py-2 font-medium">
                    {a.name}
                    {a.art9 && (
                      <span className="ml-2 rounded bg-destructive/15 px-1 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                        Art. 9
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{a.purpose}</td>
                  <td className="px-3 py-2">{a.legalBasis}</td>
                  <td className="px-3 py-2">{a.art9Basis}</td>
                  <td className="px-3 py-2 text-[11px]">{a.processors}</td>
                  <td className="px-3 py-2 text-[11px]">{a.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-base font-semibold">DE REZOLVAT (input pentru DPIA)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          {TODOS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-muted-foreground">
          Contact responsabil cu protecția datelor:{" "}
          <a className="text-primary" href="mailto:dpo@ventuza.app">
            dpo@ventuza.app
          </a>
          . Pentru lista detaliată a procesatorilor vezi{" "}
          <Link className="text-primary" to="/legal/subprocessors">
            /legal/subprocessors
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
