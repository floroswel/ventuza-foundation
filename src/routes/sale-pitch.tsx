/**
 * One-pager de vânzare pentru Ventuza.
 * Rută publică, doar lectură. Acces: /sale-pitch
 * Conține: tech stack, features, compliance posture, intervale preț,
 * plan 30 de zile pentru cumpărător.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer, ShieldCheck, Database, Sparkles, Building2, Lock, Globe2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/sale-pitch")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ventuza — Acquisition One-Pager" },
      { name: "description", content: "Sumar executiv pentru achiziția platformei Ventuza: tech stack, compliance GDPR Art. 9, monetizare B2B RO și interval de preț." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SalePitch,
});

const STACK = [
  { k: "Frontend", v: "TanStack Start v1, React 19, Vite 7, Tailwind v4" },
  { k: "Backend", v: "Supabase (Postgres 15 + RLS + pgcrypto), TanStack server fns pe Cloudflare Workers" },
  { k: "Mobil", v: "Capacitor 6 (Android + iOS), Google Play Billing + RTDN webhook" },
  { k: "AI", v: "Lovable AI Gateway (wingman, bio, moderare foto, copilot admin)" },
  { k: "Verificare", v: "Didit (KYC + age gate)" },
  { k: "Geo", v: "Bucket distance privacy-preserving, 2 straturi proximity (foreground + geofencing)" },
];

const FEATURES = {
  Dating: ["Discover/swipe/match", "Mesaje 1:1 cu media + voice", "Stories", "Visitors & favorites", "Block bilateral enforced la DB", "Travel mode", "PIN lock + discreet mode", "SOS / panic tools"],
  "B2B Partners": ["Portal partener /partner", "Wizard creare venues/events/offers", "Quota & moderare obligatorie", "Facturare RO completă (OP bancar, TVA, numerotare neîntreruptă)", "Grace period + retrogradare automată", "Notificări status partener", "Nearby cu prioritizare per plan"],
  Admin: ["RBAC pe 6 roluri", "Audit log append-only", "Break-glass cu justificare", "2FA enforced", "Data masking by default", "CSAM no-render + hash blocklist", "DSA reports anonime", "Command palette (Cmd+K) + AI copilot"],
  GDPR: ["Art. 9 minimizat (orientare opt-in, HIV eliminat complet)", "Consent registry centralizat", "Cascade withdrawal automat", "Registru Art. 30 versionat", "Subprocesatori documentați", "Right to be Forgotten complet", "DPIA pentru date sensibile"],
};

const PRICE_RANGES = [
  { label: "Asset sale „as-is\"", range: "25.000 – 60.000 €", desc: "Fără founder, fără brand consacrat. Cumpărător oportunist preia codul + infra." },
  { label: "Asset sale + handover 3 luni", range: "60.000 – 120.000 €", desc: "Brand Ventuza + 1k useri activi + 3 luni suport. Competitor RO/regional care vrea shortcut la GDPR + B2B RO." },
  { label: "Acquihire (6–12 luni)", range: "120.000 – 250.000 €", desc: "Founder rămâne să opereze. Player european care intră pe piața RO." },
  { label: "Strategic sale (cu PMF)", range: "250.000 – 500.000+ €", desc: "Necesită D30 retention >20% și ≥1 partener B2B plătit. Grindr/Romeo/Hornet sau fond local." },
];

const DAY_30 = [
  "Semnare .aab + publicare Google Play (asset deja pregătit, lipsește signing key)",
  "Completare Data Safety form Play Store",
  "Migrare DNS ventuza.eu pe cumpărător",
  "Handover credențiale: Supabase, Cloudflare, Didit, Lovable Cloud, Google Play Console",
  "Onboarding 3-5 venues plătitoare în București (lead-uri demo deja în DB)",
  "Setup billing real cu prima emitere facturi recurente prin pg_cron (cod live)",
  "Transfer DPO formal + actualizare /legal/privacy",
];

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "green" | "amber" }) {
  const t = tone === "green" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : tone === "amber" ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
    : "bg-muted text-foreground border-border";
  return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${t}`}>{children}</span>;
}

function SalePitch() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur print:hidden">
        <div className="mx-auto max-w-4xl px-5 py-3 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> Acasă</Link>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
            <Printer className="size-3.5" /> Printează / Salvează PDF
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 space-y-10 print:py-4 print:space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Pill tone="amber">CONFIDENTIAL</Pill>
            <Pill>One-pager achiziție</Pill>
            <Pill>2026</Pill>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Ventuza — platformă dating LGBTQ+ cu monetizare B2B RO</h1>
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            Operată de <span className="font-medium text-foreground">VOMIX GENIUS S.R.L.</span> · ventuza.eu · TanStack Start +
            Supabase + Capacitor. Construită GDPR-first cu enforcement la nivel DB pentru date Art. 9 (orientare, sănătate,
            biometrice). Singura platformă dating din RO cu billing B2B prin ordin de plată complet automatizat.
          </p>
        </section>

        <section className="grid md:grid-cols-4 gap-3">
          {[
            { i: ShieldCheck, t: "GDPR Art. 9", v: "Criptare pgcrypto + cascade withdrawal" },
            { i: Database, t: "RLS 100%", v: "Fiecare tabel cu policies + GRANT" },
            { i: Building2, t: "B2B Billing RO", v: "OP bancar, TVA, numerotare legală" },
            { i: Sparkles, t: "AI nativ", v: "Wingman, moderare foto, admin copilot" },
          ].map(({ i: Icon, t, v }) => (
            <div key={t} className="rounded-xl border border-border bg-surface p-3">
              <Icon className="size-5 text-primary" />
              <div className="mt-2 text-sm font-semibold">{t}</div>
              <div className="text-xs text-muted-foreground">{v}</div>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Lock className="size-4" /> Tech stack</h2>
          <dl className="rounded-xl border border-border divide-y divide-border bg-surface text-sm">
            {STACK.map(({ k, v }) => (
              <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Inventar funcționalități</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.entries(FEATURES).map(([cat, items]) => (
              <div key={cat} className="rounded-xl border border-border bg-surface p-4">
                <div className="text-sm font-semibold mb-2">{cat}</div>
                <ul className="space-y-1">
                  {items.map((f) => (
                    <li key={f} className="flex gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Globe2 className="size-4" /> Compliance posture</h2>
          <div className="rounded-xl border border-border bg-surface p-4 text-sm space-y-2">
            <p>· <strong>Registru Art. 30</strong> versionat în <code>docs/gdpr-art-30-register.md</code> + pagina <code>/legal/records-of-processing</code>.</p>
            <p>· <strong>Inventar procesatori</strong> public la <code>/legal/subprocessors</code>, sincronizat cu fluxurile reale.</p>
            <p>· <strong>Date Art. 9 criptate</strong> la nivel coloană cu pgcrypto. Cheie izolată în secret server. Decriptare doar prin RPC SECURITY DEFINER, grant strict pe service_role.</p>
            <p>· <strong>Triggere DB</strong> blochează scrieri pe câmpuri sensibile fără consimțământ activ; retragerea cascadează în NULL în aceeași tranzacție.</p>
            <p>· <strong>Verificare vârstă</strong> Didit integrată, forțată ON în producție via <code>shouldEnforceAgeGate</code> (host-based, nu flag-based).</p>
            <p>· <strong>CSAM no-render</strong>: rapoartele nu expun <code>photo_url</code>; doar hash perceptual + sha256 pentru blocare globală.</p>
            <p>· <strong>DSA reports anonime</strong>: <code>reporter_email/user_id</code> strippate din toate proiecțiile admin.</p>
            <p>· <strong>Documente legale P0 complete</strong>: terms, privacy, cookies, community, safety, age-policy, dmca, dsa, subprocessors.</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Intervale de preț (RO, 2026)</h2>
          <div className="space-y-2">
            {PRICE_RANGES.map((p) => (
              <div key={p.label} className="rounded-xl border border-border bg-surface p-4 grid md:grid-cols-[1fr_180px] gap-3 items-center">
                <div>
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{p.desc}</div>
                </div>
                <div className="text-right font-mono text-base font-bold text-primary">{p.range}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <strong>Asking price recomandat azi (1.000 useri instalați, MRR=0):</strong> <span className="text-primary font-semibold">65.000 – 90.000 €</span> asset sale + handover 3 luni.
            La 3-5 parteneri B2B plătitori (~3.000 € MRR) intervalul urcă natural la 150.000 – 200.000 €.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Cost de înlocuire (rebuild from scratch)</h2>
          <div className="rounded-xl border border-border bg-surface p-4 text-sm space-y-2">
            <p>· Echipă: 1 senior full-stack + 1 backend + 0.5 designer + 0.5 consultant GDPR · <strong>8–12 luni</strong></p>
            <p>· Manoperă la rate RO de piață: <strong>150.000 – 250.000 €</strong></p>
            <p>· Consultanță GDPR specializată Art. 9: <strong>15.000 – 30.000 €</strong></p>
            <p>· Cost biblioteci, infra dev, testing: <strong>5.000 – 10.000 €</strong></p>
            <p className="pt-2 border-t border-border"><strong>Total replacement cost: 170.000 – 290.000 €</strong></p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Plan 30 de zile post-achiziție</h2>
          <ol className="space-y-2">
            {DAY_30.map((s, i) => (
              <li key={s} className="rounded-xl border border-border bg-surface p-3 flex gap-3 text-sm">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-primary/40 bg-primary/5 p-5">
          <div className="text-sm font-semibold mb-1">Contact LOI / due diligence</div>
          <div className="text-xs text-muted-foreground">VOMIX GENIUS S.R.L. · contact@ventuza.eu · NDA + data room disponibile la cerere (cod sursă, registru Art. 30, DPIA, RLS audit, demo flow B2B end-to-end).</div>
        </section>

        <footer className="text-center text-[10px] text-muted-foreground pt-4 border-t border-border">
          Document confidențial. Cifrele de preț sunt estimări de piață RO/EU 2026, nu garanții. Evaluarea finală depinde de due diligence (DAU/MAU, retention, MRR B2B, contracte semnate).
        </footer>
      </main>
    </div>
  );
}
