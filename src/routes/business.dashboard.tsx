import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/hooks/useUserRole";
import { getMyAdvertiser, listMyCampaigns, type Advertiser, type AdCampaign, type AdPlacement } from "@/lib/ads";
import { Building2, Plus, BarChart3, Loader2, ChevronLeft, ExternalLink, Eye, MousePointerClick, CircleDollarSign, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/business/dashboard")({
  head: () => ({ meta: [{ title: "Panou Business — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: BusinessDashboard,
});

const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  events_banner: "Banner pe Evenimente",
  discover_card: "Card sponsorizat în Discover",
  event_boost: "Boost pentru evenimentul tău",
};

const PRICING: Record<AdPlacement, { perDayEur: number; minDays: number }> = {
  events_banner: { perDayEur: 15, minDays: 3 },
  discover_card: { perDayEur: 25, minDays: 3 },
  event_boost: { perDayEur: 10, minDays: 1 },
};

function BusinessDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [advertiser, setAdvertiser] = useState<Advertiser | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  const isBusiness = roles.includes("business") || roles.includes("admin");

  useEffect(() => {
    if (!user || !isBusiness) return;
    (async () => {
      setLoading(true);
      try {
        const a = await getMyAdvertiser();
        setAdvertiser(a);
        if (a) {
          const cs = await listMyCampaigns(a.id);
          setCampaigns(cs);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isBusiness]);

  if (authLoading || rolesLoading || loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isBusiness) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-background px-6 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-semibold">Acces rezervat partenerilor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pentru a accesa panoul business, trimite o cerere de parteneriat.
        </p>
        <Link to="/business" className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
          Aplică acum
        </Link>
      </main>
    );
  }

  async function createAdvertiser(form: FormData) {
    if (!user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("advertisers")
        .insert({
          owner_id: user.id,
          brand_name: String(form.get("brand_name") || "").trim(),
          contact_email: String(form.get("contact_email") || "").trim(),
          contact_phone: String(form.get("contact_phone") || "").trim() || null,
          website: String(form.get("website") || "").trim() || null,
          category: String(form.get("category") || "venue"),
        })
        .select()
        .single();
      if (error) throw error;
      setAdvertiser(data as Advertiser);
      toast.success("Profilul brand-ului a fost creat");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare la creare");
    } finally {
      setCreating(false);
    }
  }

  async function createCampaign(form: FormData) {
    if (!advertiser) return;
    setCreating(true);
    try {
      const placement = String(form.get("placement") || "events_banner") as AdPlacement;
      const starts = String(form.get("starts_at"));
      const ends = String(form.get("ends_at"));
      const days = Math.max(1, Math.ceil((new Date(ends).getTime() - new Date(starts).getTime()) / 86400000));
      const price = PRICING[placement];
      if (days < price.minDays) {
        toast.error(`Minim ${price.minDays} zile pentru acest placement`);
        return;
      }
      const budgetCents = days * price.perDayEur * 100;
      const { data, error } = await supabase
        .from("ad_campaigns")
        .insert({
          advertiser_id: advertiser.id,
          placement,
          title: String(form.get("title") || "").trim(),
          body: String(form.get("body") || "").trim() || null,
          image_url: String(form.get("image_url") || "").trim() || null,
          cta_label: String(form.get("cta_label") || "Află mai mult").trim(),
          cta_url: String(form.get("cta_url") || "").trim() || null,
          city: String(form.get("city") || "").trim() || null,
          budget_cents: budgetCents,
          starts_at: new Date(starts).toISOString(),
          ends_at: new Date(ends).toISOString(),
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      setCampaigns((prev) => [data as AdCampaign, ...prev]);
      setShowForm(false);
      toast.success("Campanie trimisă spre aprobare");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setCreating(false);
    }
  }

  const totalImpressions = campaigns.reduce((s, c) => s + ((c as unknown as { impressions?: number }).impressions ?? 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + ((c as unknown as { clicks?: number }).clicks ?? 0), 0);
  const totalSpend = campaigns.reduce((s, c) => s + ((c as unknown as { budget_cents?: number }).budget_cents ?? 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-background pb-12">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-3 py-3 backdrop-blur">
        <Link to="/partner" className="rounded-full p-2 hover:bg-muted" aria-label="Portal Partener">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Panou Business</h1>
        </div>
        <Link to="/partner" className="text-xs text-muted-foreground hover:text-foreground underline">
          Locuri & evenimente
        </Link>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4">
        {!advertiser ? (
          <section className="rounded-2xl border border-border/60 bg-card p-4">
            <h2 className="mb-1 text-base font-semibold">Configurează brand-ul</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Datele apar pe campaniile tale și pot fi verificate de echipa Ventuza.
            </p>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                createAdvertiser(new FormData(e.currentTarget));
              }}
            >
              <input name="brand_name" required placeholder="Nume brand" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input name="contact_email" type="email" required placeholder="Email contact" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input name="contact_phone" placeholder="Telefon (opțional)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input name="website" type="url" placeholder="https://..." className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <select name="category" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="venue">Local / Bar / Club</option>
                <option value="event">Organizator eveniment</option>
                <option value="brand">Brand / Marcă</option>
                <option value="ngo">ONG / Asociație</option>
                <option value="service">Serviciu</option>
              </select>
              <button disabled={creating} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {creating ? "Se creează…" : "Creează profil brand"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">{advertiser.brand_name}</h2>
                    {advertiser.verified && <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{advertiser.contact_email}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase">{advertiser.category}</span>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-2">
              <Stat icon={<Eye className="h-4 w-4" />} label="Afișări" value={totalImpressions.toLocaleString()} />
              <Stat icon={<MousePointerClick className="h-4 w-4" />} label="Click-uri" value={`${totalClicks} · ${ctr}%`} />
              <Stat icon={<CircleDollarSign className="h-4 w-4" />} label="Buget total" value={`€${(totalSpend / 100).toFixed(0)}`} />
            </section>

            <section className="rounded-2xl border border-border/60 bg-card">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Campaniile mele</h3>
                </div>
                <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" /> {showForm ? "Anulează" : "Campanie nouă"}
                </button>
              </div>

              {showForm && (
                <form
                  className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createCampaign(new FormData(e.currentTarget));
                  }}
                >
                  <select name="placement" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    {(Object.keys(PLACEMENT_LABELS) as AdPlacement[]).map((p) => (
                      <option key={p} value={p}>
                        {PLACEMENT_LABELS[p]} — €{PRICING[p].perDayEur}/zi (min {PRICING[p].minDays} zile)
                      </option>
                    ))}
                  </select>
                  <input name="title" required maxLength={60} placeholder="Titlu (max 60)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  <textarea name="body" maxLength={140} rows={2} placeholder="Descriere scurtă (max 140)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  <input name="image_url" type="url" placeholder="URL imagine (opțional)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="cta_label" placeholder="CTA (ex: Vezi oferta)" defaultValue="Află mai mult" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <input name="cta_url" type="url" placeholder="URL CTA" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <input name="city" placeholder="Oraș țintă (gol = toate)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted-foreground">
                      Start
                      <input name="starts_at" type="datetime-local" required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Sfârșit
                      <input name="ends_at" type="datetime-local" required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bugetul se calculează automat după placement × zile. Plată la facturare lunară.
                  </p>
                  <button disabled={creating} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {creating ? "Se trimite…" : "Trimite spre aprobare"}
                  </button>
                </form>
              )}

              <ul className="divide-y divide-border/60">
                {campaigns.length === 0 && !showForm && (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nu ai campanii încă. Creează prima ta campanie.
                  </li>
                )}
                {campaigns.map((c) => {
                  const cAny = c as unknown as { impressions?: number; clicks?: number; budget_cents?: number };
                  return (
                    <li key={c.id} className="flex flex-col gap-1 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.title}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{PLACEMENT_LABELS[c.placement]}</span>
                        {c.city && <span>· {c.city}</span>}
                        <span>· {new Date(c.starts_at).toLocaleDateString()} → {new Date(c.ends_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {cAny.impressions ?? 0}</span>
                        <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {cAny.clicks ?? 0}</span>
                        <span className="flex items-center gap-1"><CircleDollarSign className="h-3 w-3" /> €{((cAny.budget_cents ?? 0) / 100).toFixed(0)}</span>
                        {c.cta_url && (
                          <a href={c.cta_url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-primary">
                            CTA <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <p className="px-1 text-xs text-muted-foreground">
              Toate campaniile sunt revizuite manual de echipa Ventuza pentru conformitate cu Charter-ul LGBTQ+ și DSA.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-600",
    pending: "bg-amber-500/15 text-amber-600",
    paused: "bg-muted text-muted-foreground",
    rejected: "bg-destructive/15 text-destructive",
    ended: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}
