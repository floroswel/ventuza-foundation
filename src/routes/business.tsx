import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, CheckCircle2, ChevronLeft, Loader2, Sparkles, ShieldCheck, Megaphone, HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Înscriere parteneri B2B — Ventuza" },
      { name: "description", content: "Firme, branduri, ONG-uri, asociații și organizatori de evenimente: înscrieți-vă ca parteneri Ventuza." },
      { property: "og:title", content: "Devino partener Ventuza — B2B" },
      { property: "og:description", content: "Reclamă, evenimente promovate și parteneriate strategice pentru brand-uri LGBTQ+ friendly." },
    ],
  }),
  component: BusinessPage,
});

const entityLabels: Record<string, string> = {
  srl: "SRL",
  pfa: "PFA",
  ii: "Întreprindere Individuală",
  sa: "SA",
  ong: "ONG",
  asociatie: "Asociație",
  fundatie: "Fundație",
  brand: "Brand / Marcă",
  organizator_eveniment: "Organizator evenimente",
  altul: "Altul",
};

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
});

function BusinessPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    entity_type: "srl" as const,
    legal_name: "",
    brand_name: "",
    cui: "",
    reg_com: "",
    vat_number: "",
    country: "RO",
    city: "",
    address: "",
    contact_name: "",
    contact_role: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    social_links: "",
    category: "",
    goals: "",
    monthly_budget_eur: "" as string,
    accepts_terms: false,
    accepts_dpa: false,
    accepts_lgbt_charter: false,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
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
      const { data: sess } = await supabase.auth.getUser();
      const insertRow = {
        ...parsed,
        brand_name: parsed.brand_name || null,
        cui: parsed.cui || null,
        reg_com: parsed.reg_com || null,
        vat_number: parsed.vat_number || null,
        city: parsed.city || null,
        address: parsed.address || null,
        contact_role: parsed.contact_role || null,
        contact_phone: parsed.contact_phone || null,
        website: parsed.website || null,
        social_links: parsed.social_links || null,
        category: parsed.category || null,
        monthly_budget_eur: parsed.monthly_budget_eur ?? null,
        user_id: sess.user?.id ?? null,
      };
      const { error } = await supabase.from("business_applications").insert(insertRow);
      if (error) throw error;
      setDone(true);
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

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
          <Link to="/" className="flex size-9 items-center justify-center rounded-full border border-border">
            <ChevronLeft className="size-4" />
          </Link>
          <h1 className="text-base font-semibold">Cerere primită</h1>
        </header>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
          <CheckCircle2 className="size-16 text-primary" />
          <h2 className="text-2xl font-semibold">Mulțumim!</h2>
          <p className="text-sm text-muted-foreground">
            Echipa Ventuza analizează cererea ta și te contactează pe email în maximum 3 zile lucrătoare cu propunere comercială și pașii următori.
          </p>
          <Link to="/" className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
            Înapoi acasă
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Parteneri B2B</h1>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-surface glow-gold">
            <Building2 className="size-6 text-primary" />
          </div>
          <div>
            <h2 className="wordmark text-2xl font-medium">Devino partener Ventuza</h2>
            <p className="text-xs text-muted-foreground">Firme · branduri · ONG-uri · asociații · organizatori</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-foreground/80">
          Ventuza este platforma LGBTQ+ din România. Dacă vrei să comunici autentic cu comunitatea — fie ca brand, organizator
          Pride, bar, clinică, ONG sau asociație — completează formularul. Toate aplicațiile sunt evaluate manual.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Feature icon={<Megaphone className="size-4" />} title="Reclamă targetată" desc="Banner Discover & Events" />
          <Feature icon={<Sparkles className="size-4" />} title="Evenimente promovate" desc="Boost RSVP & vizibilitate" />
          <Feature icon={<HeartHandshake className="size-4" />} title="Parteneriate" desc="ONG · Pride · clinici" />
        </div>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <Card title="Despre organizație">
            <Field label="Tip entitate *">
              <select
                value={form.entity_type}
                onChange={(e) => set("entity_type", e.target.value as typeof form.entity_type)}
                className="input"
                required
              >
                {Object.entries(entityLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Denumire legală *">
              <input className="input" value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="ex: Acme Marketing SRL" required />
            </Field>
            <Field label="Brand / nume comercial">
              <input className="input" value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} placeholder="ex: Acme Pride" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CUI / CIF">
                <input className="input" value={form.cui} onChange={(e) => set("cui", e.target.value)} placeholder="RO12345678" />
              </Field>
              <Field label="Nr. Reg. Comerțului">
                <input className="input" value={form.reg_com} onChange={(e) => set("reg_com", e.target.value)} placeholder="J40/1234/2020" />
              </Field>
            </div>
            <Field label="VAT intra-UE (opțional)">
              <input className="input" value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)} placeholder="DE123456789" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Țară *">
                <input className="input uppercase" maxLength={2} value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase())} required />
              </Field>
              <Field label="Oraș">
                <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="Categorie">
                <input className="input" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="bar · ONG · sănătate" />
              </Field>
            </div>
            <Field label="Adresă sediu">
              <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </Card>

          <Card title="Persoană de contact">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nume *">
                <input className="input" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} required />
              </Field>
              <Field label="Funcție">
                <input className="input" value={form.contact_role} onChange={(e) => set("contact_role", e.target.value)} placeholder="Marketing Manager" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email *">
                <input type="email" className="input" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} required />
              </Field>
              <Field label="Telefon">
                <input className="input" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+40 7xx xxx xxx" />
              </Field>
            </div>
            <Field label="Website">
              <input className="input" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Social media (linkuri, virgulă)">
              <input className="input" value={form.social_links} onChange={(e) => set("social_links", e.target.value)} placeholder="instagram.com/… , facebook.com/…" />
            </Field>
          </Card>

          <Card title="Obiectiv parteneriat">
            <Field label="Ce vrei să faci pe Ventuza? *">
              <textarea
                className="input min-h-[120px]"
                value={form.goals}
                onChange={(e) => set("goals", e.target.value)}
                placeholder="ex: promovare bar gay-friendly din București, recrutare voluntari Pride, distribuire materiale prevenție HIV…"
                required
                maxLength={2000}
              />
            </Field>
            <Field label="Buget lunar estimat (EUR, opțional)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.monthly_budget_eur}
                onChange={(e) => set("monthly_budget_eur", e.target.value)}
                placeholder="500"
              />
            </Field>
          </Card>

          <Card title="Conformitate & acorduri">
            <Check
              checked={form.accepts_terms}
              onChange={(v) => set("accepts_terms", v)}
              label={
                <>
                  Am citit și accept <Link to="/legal/business-terms" className="text-primary underline">Termenii B2B</Link>{" "}
                  (facturare TVA, retragere, SAL ANPC).
                </>
              }
            />
            <Check
              checked={form.accepts_dpa}
              onChange={(v) => set("accepts_dpa", v)}
              label={
                <>
                  Am citit <Link to="/legal/privacy" className="text-primary underline">Politica de confidențialitate</Link>{" "}
                  și accept procesarea datelor de contact conform GDPR (Art. 6.1.b — execuție contract).
                </>
              }
            />
            <Check
              checked={form.accepts_lgbt_charter}
              onChange={(v) => set("accepts_lgbt_charter", v)}
              label={
                <>
                  Confirm că <strong>NU</strong> promovez terapii de conversie, discurs anti-LGBTQ+, dezinformare medicală
                  sau conținut care încalcă{" "}
                  <Link to="/legal/community" className="text-primary underline">Regulile comunității</Link>.
                </>
              }
            />
          </Card>

          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface/50 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <p>
              Datele tale sunt stocate în UE, criptate în tranzit (TLS) și accesibile doar echipei comercial Ventuza.
              Vezi <Link to="/legal/privacy" className="text-primary underline">retenția</Link> și{" "}
              <Link to="/legal/security-incidents" className="text-primary underline">procedura incidente</Link>.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground glow-gold disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Se trimite…</span>
            ) : (
              "Trimite cererea"
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Sau scrie direct la{" "}
            <a href="mailto:business@ventuza.app" className="text-primary underline">business@ventuza.app</a>
          </p>
        </form>
      </section>

      <style>{`
        .input {
          width: 100%;
          background: hsl(var(--surface));
          border: 1px solid hsl(var(--border));
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          color: hsl(var(--foreground));
          outline: none;
        }
        .input:focus { border-color: hsl(var(--primary) / 0.6); }
      `}</style>
    </div>
  );
}

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
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}
