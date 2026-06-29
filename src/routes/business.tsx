import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Building2, CheckCircle2, ChevronLeft, Loader2, Sparkles, ShieldCheck,
  Megaphone, HeartHandshake, Search, Clock, FileCheck2, HelpCircle, Mail, ChevronDown,
} from "lucide-react";
import { lookupAnafCui } from "@/lib/anaf.functions";
import { submitBusinessApplication } from "@/lib/business-apply.functions";
import { linkOrphanBusinessApps } from "@/lib/business.functions";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Parteneri B2B — Ventuza pentru firme, ONG-uri și branduri" },
      { name: "description", content: "Reclamă targetată, evenimente promovate și parteneriate Pride pentru branduri LGBTQ+ friendly din România și UE." },
      { property: "og:title", content: "Devino partener Ventuza" },
      { property: "og:description", content: "Acces la cea mai engaged comunitate LGBTQ+ din România." },
    ],
  }),
  component: BusinessPage,
});

const entityLabels: Record<string, string> = {
  srl: "SRL", pfa: "PFA", ii: "Întreprindere Individuală", sa: "SA",
  ong: "ONG", asociatie: "Asociație", fundatie: "Fundație",
  brand: "Brand / Marcă", organizator_eveniment: "Organizator evenimente", altul: "Altul",
};

const cuiRoRegex = /^(RO)?\d{2,10}$/i;

const schema = z.object({
  entity_type: z.enum(["srl","pfa","ii","sa","ong","asociatie","fundatie","brand","organizator_eveniment","altul"]),
  legal_name: z.string().trim().min(2, "Denumire legală obligatorie").max(200),
  brand_name: z.string().trim().max(120).optional().or(z.literal("")),
  cui: z.string().trim().max(20).optional().or(z.literal("")),
  reg_com: z.string().trim().max(40).optional().or(z.literal("")),
  vat_number: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().min(2).max(2),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  contact_name: z.string().trim().min(2, "Nume contact obligatoriu").max(120),
  contact_role: z.string().trim().max(80).optional().or(z.literal("")),
  contact_email: z.string().trim().email("Email invalid").max(200),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().url("URL invalid").max(200).optional().or(z.literal("")),
  social_links: z.string().trim().max(500).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  goals: z.string().trim().min(20, "Descrie pe scurt ce vrei să faci (min. 20 caractere)").max(2000),
  monthly_budget_eur: z.number().int().min(0).max(1_000_000).optional(),
  accepts_terms: z.literal(true, { errorMap: () => ({ message: "Trebuie să accepți termenii" }) }),
  accepts_dpa: z.literal(true, { errorMap: () => ({ message: "Trebuie să accepți DPA" }) }),
  accepts_lgbt_charter: z.literal(true, { errorMap: () => ({ message: "Trebuie să accepți charta LGBTQ+" }) }),
}).superRefine((v, ctx) => {
  if (v.country === "RO" && v.cui && !cuiRoRegex.test(v.cui)) {
    ctx.addIssue({ code: "custom", path: ["cui"], message: "CUI invalid (ex: RO12345678)" });
  }
});

const STATUS_KEY = "vz_biz_app";

function BusinessPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"landing" | "form" | "done">("landing");
  const [submitting, setSubmitting] = useState(false);
  const [savedAppId, setSavedAppId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [anafLoading, setAnafLoading] = useState(false);
  const anafLookup = useServerFn(lookupAnafCui);
  const submitApp = useServerFn(submitBusinessApplication);
  const linkOrphans = useServerFn(linkOrphanBusinessApps);

  const [form, setForm] = useState({
    entity_type: "srl" as const,
    legal_name: "", brand_name: "", cui: "", reg_com: "", vat_number: "",
    country: "RO", city: "", address: "",
    contact_name: "", contact_role: "", contact_email: "", contact_phone: "",
    website: "", social_links: "", category: "",
    goals: "", monthly_budget_eur: "" as string,
    accepts_terms: false, accepts_dpa: false, accepts_lgbt_charter: false,
  });

  // Check for prior application
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATUS_KEY);
      if (!raw) return;
      const { id } = JSON.parse(raw);
      if (!id) return;
      setSavedAppId(id);
      supabase
        .from("business_applications")
        .select("status, legal_name")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setSavedStatus(data.status ?? "pending");
        });
    } catch {/* ignore */}
  }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function fetchAnaf() {
    if (!form.cui) { toast.error("Introdu CUI-ul mai întâi"); return; }
    setAnafLoading(true);
    try {
      const r = await anafLookup({ data: { cui: form.cui } });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setForm((f) => ({
        ...f,
        cui: r.cui,
        legal_name: r.legal_name || f.legal_name,
        reg_com: r.reg_com || f.reg_com,
        vat_number: r.vat_number || f.vat_number,
        city: r.city || f.city,
        address: r.address || f.address,
        contact_phone: r.phone || f.contact_phone,
      }));
      toast.success(`Găsit: ${r.legal_name}${r.vat_payer ? " (plătitor TVA)" : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare ANAF");
    } finally {
      setAnafLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        monthly_budget_eur: form.monthly_budget_eur === "" ? undefined : Number(form.monthly_budget_eur),
      };
      const parsed = schema.parse(payload);
      // Strip the three accepts_* booleans — they're enforced server-side.
      const { accepts_terms: _t, accepts_dpa: _d, accepts_lgbt_charter: _l, ...rest } = parsed;
      void _t; void _d; void _l;
      const res = await submitApp({ data: rest as any });
      if (res?.id) {
        try { localStorage.setItem(STATUS_KEY, JSON.stringify({ id: res.id, at: Date.now() })); } catch {/**/}
        setSavedAppId(res.id);
        setSavedStatus("pending");
        // If submitter is authenticated, link the orphan application to their
        // user_id immediately so /partner pending state + /partner/billing
        // profile lookup work without depending on a second sign-in.
        if (user) {
          try { await linkOrphans({}); } catch { /* best-effort */ }
        }
      }
      setView("done");
      toast.success("Cerere trimisă! Te contactăm pe email în 3 zile lucrătoare.");
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message ?? "Date invalide");
      } else {
        toast.error(err instanceof Error ? err.message : "Eroare la trimitere");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Parteneri B2B</h1>
        {view === "form" && (
          <button onClick={() => setView("landing")} className="ml-auto text-xs text-muted-foreground hover:text-primary">
            ← Vezi detalii
          </button>
        )}
      </header>

      {view === "done" ? (
        <DoneScreen appId={savedAppId} />
      ) : view === "form" ? (
        <FormView
          form={form} set={set} submit={submit} submitting={submitting}
          anafLoading={anafLoading} fetchAnaf={fetchAnaf}
        />
      ) : (
        <Landing
          savedStatus={savedStatus}
          onStart={() => setView("form")}
        />
      )}

      <style>{`
        .input {
          width: 100%; background: hsl(var(--surface));
          border: 1px solid hsl(var(--border)); border-radius: 12px;
          padding: 10px 12px; font-size: 14px; color: hsl(var(--foreground)); outline: none;
        }
        .input:focus { border-color: hsl(var(--primary) / 0.6); }
      `}</style>
    </div>
  );
}

/* ───────────────────────── LANDING ───────────────────────── */

function Landing({ savedStatus, onStart }: { savedStatus: string | null; onStart: () => void }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      {savedStatus && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <Clock className="size-5 shrink-0 text-primary" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Ai deja o cerere în curs.</p>
            <p className="text-xs text-muted-foreground">
              Status: <span className="font-medium text-primary">{statusLabel(savedStatus)}</span>. Te contactăm pe email.
            </p>
            {savedStatus === "approved" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to="/partner" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  Portal Partener (locuri & evenimente) →
                </Link>
                <Link to="/business/dashboard" className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary">
                  Campanii publicitare
                </Link>
              </div>
            )}
          </div>
        </div>
      )}


      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-surface glow-gold">
          <Building2 className="size-6 text-primary" />
        </div>
        <div>
          <h2 className="wordmark text-2xl font-medium">Comunică autentic cu LGBTQ+</h2>
          <p className="text-xs text-muted-foreground">Firme · branduri · ONG-uri · asociații · organizatori</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-foreground/80">
        Ventuza este platforma queer din România. Conectăm brand-uri etice cu o comunitate engaged,
        verificată și activă în București, Cluj, Timișoara, Iași și restul UE.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Feature icon={<Megaphone className="size-4" />} title="Reclamă" desc="Discover · Events · Map" />
        <Feature icon={<Sparkles className="size-4" />} title="Boost evenimente" desc="RSVP & vizibilitate" />
        <Feature icon={<HeartHandshake className="size-4" />} title="Pride & ONG" desc="Parteneriate strategice" />
      </div>

      {/* PRICING */}
      <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pachete orientative</h3>
      <div className="mt-3 space-y-3">
        <Tier
          name="Community" price="GRATUIT"
          desc="Pentru ONG-uri LGBTQ+, asociații Pride, clinici de testare HIV/ITS, linii de criză."
          perks={["Profil verificat", "Listare evenimente", "Badge ONG", "Suport email"]}
        />
        <Tier
          name="Starter" price="749 RON / lună" highlight
          desc="Pentru baruri, cluburi, branduri locale gay-friendly."
          perks={["Banner Discover (city-targeted)", "1 eveniment promovat / lună", "Statistici impresii", "Factură cu TVA"]}
        />
        <Tier
          name="Growth" price="2.490 RON / lună"
          desc="Pentru branduri naționale și organizatori Pride."
          perks={["Banner național + city", "5 evenimente boost", "Stories sponsorizate", "Account manager dedicat"]}
        />
        <Tier
          name="Custom" price="La cerere"
          desc="Campanii Pride Month, lansări produs, parteneriate UE."
          perks={["Briefing comun", "Co-creație content", "Reporting săptămânal", "Contract-cadru anual"]}
        />
      </div>

      {/* WHAT YOU NEED */}
      <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">De ce ai nevoie ca să aplici</h3>
      <ul className="mt-3 space-y-2 text-sm">
        <Need>CUI / CIF (sau echivalent UE) — completăm automat din ANAF</Need>
        <Need>Denumire legală și nr. Reg. Comerțului</Need>
        <Need>Email contact (factură + comunicare)</Need>
        <Need>Website sau social media activ</Need>
        <Need>Acceptarea <Link to="/legal/business-terms" className="text-primary underline">termenilor B2B</Link> și a <Link to="/legal/community" className="text-primary underline">chartei LGBTQ+</Link></Need>
      </ul>

      {/* FAQ */}
      <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Întrebări frecvente</h3>
      <div className="mt-3 space-y-2">
        <Faq q="Cât durează aprobarea?">3 zile lucrătoare. Verificăm manual fiecare aplicant — fără excepții.</Faq>
        <Faq q="Pot aplica și fără cont?">Da, dar îți recomandăm să-ți creezi unul ca să primești update-uri și să gestionezi campanii.</Faq>
        <Faq q="Ce branduri respingeți?">Orice promovează terapii de conversie, dezinformare medicală, conținut anti-LGBTQ+ sau încalcă regulile comunității.</Faq>
        <Faq q="Emiteți facturi cu TVA?">Da, RO-eFactura pentru clienți români, reverse charge pentru UE (cu VAT valid).</Faq>
        <Faq q="Pot anula contractul?">Da, conform OUG 34/2014 — 14 zile retragere pentru servicii neîncepute. Detalii în Termenii B2B.</Faq>
        <Faq q="Datele mele sunt în siguranță?">Stocate în UE, criptate TLS, GDPR-compliant. Vezi <Link to="/legal/security-incidents" className="text-primary underline">procedura noastră</Link>.</Faq>
      </div>

      <button
        onClick={onStart}
        className="mt-8 w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground glow-gold"
      >
        Începe aplicația →
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Sau scrie la <a href="mailto:business@ventuza.app" className="text-primary underline">business@ventuza.app</a>
      </p>
    </section>
  );
}

function Tier({ name, price, desc, perks, highlight }: { name: string; price: string; desc: string; perks: string[]; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-primary/50 bg-primary/5" : "border-border bg-surface/40"}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{name}</p>
        <p className={`text-sm font-medium ${highlight ? "text-primary" : "text-foreground"}`}>{price}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-foreground/80">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary" />{p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Need({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-xl border border-border bg-surface/30 px-3 py-2 text-xs text-foreground/85">
      <FileCheck2 className="mt-0.5 size-4 shrink-0 text-primary" /><span>{children}</span>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button" onClick={() => setOpen((o) => !o)}
      className="w-full rounded-xl border border-border bg-surface/30 px-3 py-2.5 text-left"
    >
      <div className="flex items-center gap-2">
        <HelpCircle className="size-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">{q}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </div>
      {open && <p className="mt-2 pl-6 text-xs text-muted-foreground">{children}</p>}
    </button>
  );
}

function statusLabel(s: string) {
  return { pending: "În așteptare", reviewing: "În analiză", approved: "Aprobat ✓", rejected: "Respins", needs_info: "Necesită clarificări" }[s] ?? s;
}

/* ───────────────────────── FORM ───────────────────────── */

function FormView({
  form, set, submit, submitting, anafLoading, fetchAnaf,
}: {
  form: any; set: (k: any, v: any) => void; submit: (e: React.FormEvent) => void;
  submitting: boolean; anafLoading: boolean; fetchAnaf: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <form onSubmit={submit} className="space-y-6">
        <Card title="Despre organizație">
          <Field label="Tip entitate *">
            <select value={form.entity_type} onChange={(e) => set("entity_type", e.target.value)} className="input" required>
              {Object.entries(entityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>

          {form.country === "RO" && (
            <Field label="CUI / CIF (auto-completare din ANAF)">
              <div className="flex gap-2">
                <input
                  className="input" value={form.cui}
                  onChange={(e) => set("cui", e.target.value)}
                  placeholder="RO12345678"
                />
                <button
                  type="button" onClick={fetchAnaf} disabled={anafLoading || !form.cui}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary disabled:opacity-50"
                >
                  {anafLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                  ANAF
                </button>
              </div>
            </Field>
          )}

          <Field label="Denumire legală *">
            <input className="input" value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="ex: Acme Marketing SRL" required />
          </Field>
          <Field label="Brand / nume comercial">
            <input className="input" value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} placeholder="ex: Acme Pride" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nr. Reg. Comerțului">
              <input className="input" value={form.reg_com} onChange={(e) => set("reg_com", e.target.value)} placeholder="J40/1234/2020" />
            </Field>
            <Field label="VAT intra-UE">
              <input className="input" value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)} placeholder="DE123456789" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Țară *">
              <input className="input uppercase" maxLength={2} value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase())} required />
            </Field>
            <Field label="Oraș">
              <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Categorie">
              <input className="input" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="bar · ONG" />
            </Field>
          </div>
          <Field label="Adresă sediu">
            <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </Card>

        <Card title="Persoană de contact">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nume *"><input className="input" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} required /></Field>
            <Field label="Funcție"><input className="input" value={form.contact_role} onChange={(e) => set("contact_role", e.target.value)} placeholder="Marketing Manager" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email *"><input type="email" className="input" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} required /></Field>
            <Field label="Telefon"><input className="input" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+40 7xx xxx xxx" /></Field>
          </div>
          <Field label="Website"><input type="url" inputMode="url" className="input" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Social media (linkuri, virgulă)">
            <input className="input" value={form.social_links} onChange={(e) => set("social_links", e.target.value)} placeholder="instagram.com/… , facebook.com/…" />
          </Field>
        </Card>

        <Card title="Obiectiv parteneriat">
          <Field label="Ce vrei să faci pe Ventuza? *">
            <textarea className="input min-h-[120px]" value={form.goals} onChange={(e) => set("goals", e.target.value)}
              placeholder="ex: promovare bar gay-friendly București, recrutare voluntari Pride…" required maxLength={2000} />
          </Field>
          <Field label="Buget lunar estimat (RON, opțional)">
            <input type="number" min={0} className="input" value={form.monthly_budget_eur}
              onChange={(e) => set("monthly_budget_eur", e.target.value)} placeholder="2500" />
          </Field>
        </Card>

        <Card title="Conformitate & acorduri">
          <Check checked={form.accepts_terms} onChange={(v) => set("accepts_terms", v)} label={
            <>Am citit și accept <Link to="/legal/business-terms" className="text-primary underline">Termenii B2B</Link> (facturare TVA, retragere, SAL ANPC).</>
          } />
          <Check checked={form.accepts_dpa} onChange={(v) => set("accepts_dpa", v)} label={
            <>Am citit <Link to="/legal/privacy" className="text-primary underline">Politica de confidențialitate</Link> și accept procesarea datelor conform GDPR (Art. 6.1.b).</>
          } />
          <Check checked={form.accepts_lgbt_charter} onChange={(v) => set("accepts_lgbt_charter", v)} label={
            <>Confirm că <strong>NU</strong> promovez terapii de conversie, discurs anti-LGBTQ+ sau conținut care încalcă <Link to="/legal/community" className="text-primary underline">Regulile comunității</Link>.</>
          } />
        </Card>

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface/50 p-4 text-xs text-muted-foreground">
          <ShieldCheck className="size-5 shrink-0 text-primary" />
          <p>Datele tale sunt stocate în UE, criptate TLS, accesibile doar echipei comercial Ventuza.</p>
        </div>

        <button type="submit" disabled={submitting}
          className="w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground glow-gold disabled:opacity-60">
          {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Se trimite…</span> : "Trimite cererea"}
        </button>
      </form>
    </section>
  );
}

function DoneScreen({ appId }: { appId: string | null }) {
  const { user } = useAuth();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <CheckCircle2 className="size-16 text-primary" />
      <h2 className="text-2xl font-semibold">Mulțumim!</h2>
      <p className="text-sm text-muted-foreground">
        Echipa Ventuza analizează cererea ta. Te contactăm pe email în maximum 3 zile lucrătoare.
      </p>
      {appId && (
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1 text-[11px] text-muted-foreground">
          <span>ID cerere: <code className="font-mono text-foreground break-all">{appId}</code></span>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(appId)}
            className="text-primary underline"
          >
            copiază
          </button>
        </div>
      )}
      <a href={`mailto:business@ventuza.app?subject=${encodeURIComponent(`Cerere partener ${appId ?? ""}`)}`} className="mt-2 inline-flex items-center gap-2 text-xs text-primary hover:underline">
        <Mail className="size-3.5" /> business@ventuza.app
      </a>

      <div className="mt-2 w-full space-y-3">
        {user ? (
          <>
            <Link
              to="/partner"
              className="block w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
            >
              Vezi statusul cererii →
            </Link>
            <Link
              to="/partner/guide"
              className="block w-full rounded-full border border-border px-6 py-3 text-sm text-foreground hover:bg-surface/60"
            >
              Citește ghidul partenerului
            </Link>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Vei primi email când cererea e aprobată. Postările devin disponibile abia după aprobare.
            </p>
          </>

        ) : (
          <>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="block w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
            >
              Creează cont pentru a urmări statusul →
            </Link>
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-3 text-left text-[11px] leading-snug text-orange-700 dark:text-orange-300">
              <strong>Important:</strong> creează contul cu <strong>același email</strong> ca în cerere
              (vom lega aplicația automat). Dacă folosești alt email, salvează ID-ul cererii de mai sus
              și scrie la business@ventuza.app ca să o legăm manual.
            </div>
          </>
        )}
        <Link to="/" className="block text-xs text-muted-foreground hover:text-foreground">
          ← Înapoi acasă
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────── shared ───────────────────────── */

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-3">
      <div className="flex size-8 items-center justify-center rounded-full border border-primary/30 bg-background text-primary">{icon}</div>
      <p className="mt-2 text-xs font-medium">{title}</p>
      <p className="text-[10px] leading-snug text-muted-foreground">{desc}</p>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-surface/40 p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground/80">{label}</span>
      {children}
    </label>
  );
}
function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-xs text-foreground/85">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
      <span className="leading-snug">{label}</span>
    </label>
  );
}
