import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Megaphone,
  BarChart3,
  Sparkles,
  Users,
  MapPin,
  Loader2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getMyAdvertiser, listMyCampaigns, type Advertiser, type AdCampaign } from "@/lib/ads";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/advertise")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Promovează businessul tău — Ventuza Ads" },
      {
        name: "description",
        content:
          "Ajunge la mii de utilizatori LGBTQ+ în România. Cluburi, baruri, evenimente, branduri.",
      },
    ],
  }),
  component: AdvertisePage,
});

const CATEGORIES = [
  { id: "venue", label: "Bar / Club", icon: MapPin },
  { id: "event", label: "Eveniment", icon: Sparkles },
  { id: "brand", label: "Brand", icon: Megaphone },
  { id: "media", label: "Media", icon: BarChart3 },
  { id: "other", label: "Altceva", icon: Users },
];

function AdvertisePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [adv, setAdv] = useState<Advertiser | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBusiness, setIsBusiness] = useState<boolean | null>(null);
  const [pendingApp, setPendingApp] = useState<{ status: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Check business role
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "business")
        .maybeSingle();
      const hasBusinessRole = !!roleRow;
      setIsBusiness(hasBusinessRole);

      if (hasBusinessRole) {
        const a = await getMyAdvertiser();
        setAdv(a);
        if (a) setCampaigns(await listMyCampaigns(a.id));
      } else {
        // Check if they already submitted an application
        const { data: app } = await supabase
          .from("business_applications")
          .select("status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setPendingApp(app);
      }
      setLoading(false);
    })();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/profile"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Megaphone className="size-4 text-primary" /> Ventuza Ads
        </h1>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        {isBusiness === false ? (
          <BusinessGate pendingApp={pendingApp} />
        ) : !adv ? (
          <OnboardAdvertiser onCreated={setAdv} />
        ) : (
          <AdvertiserDashboard adv={adv} campaigns={campaigns} />
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function BusinessGate({ pendingApp }: { pendingApp: { status: string } | null }) {
  const statusLabel: Record<string, string> = {
    pending: "În așteptare — evaluăm cererea ta",
    reviewing: "În analiză de echipa Ventuza",
    rejected: "Respinsă — contactează business@ventuza.app",
  };
  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-surface to-surface p-5">
      <Megaphone className="size-7 text-primary" />
      <h2 className="mt-2 text-lg font-semibold">Cont B2B necesar</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Reclamele și evenimentele promovate sunt rezervate{" "}
        <span className="font-semibold text-foreground">partenerilor B2B aprobați</span> (firme,
        branduri, ONG-uri, organizatori). Utilizatorii obișnuiți pot folosi gratuit toate funcțiile
        aplicației, dar nu pot publica anunțuri comerciale.
      </p>

      {pendingApp ? (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="font-semibold">Cererea ta a fost trimisă</p>
          <p className="mt-1">{statusLabel[pendingApp.status] ?? `Status: ${pendingApp.status}`}</p>
          <p className="mt-2 text-[10px] text-amber-200/70">
            Te contactăm pe email în max 3 zile lucrătoare. După aprobare, acces automat la
            dashboard Ads.
          </p>
        </div>
      ) : (
        <Link
          to="/business"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground"
        >
          Înscrie-te ca partener B2B
        </Link>
      )}

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        Sau scrie la{" "}
        <a href="mailto:business@ventuza.app" className="text-primary">
          business@ventuza.app
        </a>
      </p>
    </section>
  );
}

function OnboardAdvertiser({ onCreated }: { onCreated: (a: Advertiser) => void }) {
  const { user } = useAuth();
  const [brand, setBrand] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState("venue");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!brand.trim() || !email.trim()) return toast.error("Brand și email sunt obligatorii.");
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("advertisers")
        .insert({
          owner_id: user.id,
          brand_name: brand.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim() || null,
          website: website.trim() || null,
          category,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Cont advertiser creat. Hai să facem prima campanie!");
      onCreated(data as Advertiser);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-surface to-surface p-5">
        <Megaphone className="size-7 text-primary" />
        <h2 className="mt-2 text-lg font-semibold">Promovează-ți businessul</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ventuza e <span className="font-semibold text-foreground">100% gratuit</span> pentru
          utilizatori. Ne susținem prin parteneriate cu cluburi, baruri, evenimente și branduri
          LGBTQ-friendly din România.
        </p>
      </section>

      <ul className="space-y-2">
        {[
          {
            icon: Users,
            t: "Audiență verificată",
            d: "Utilizatori reali, verificați prin selfie + AI.",
          },
          { icon: MapPin, t: "Targetare pe oraș", d: "Promovează doar în orașele unde operezi." },
          {
            icon: BarChart3,
            t: "Statistici clare",
            d: "Vezi impressions și click-uri în timp real.",
          },
          {
            icon: Sparkles,
            t: "Format nativ",
            d: "Apari în Events sau Discover, fără să sufoci experiența.",
          },
        ].map(({ icon: I, t, d }) => (
          <li
            key={t}
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <I className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">{t}</p>
              <p className="text-xs text-muted-foreground">{d}</p>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold">Creează cont advertiser</p>

        <div>
          <label className="text-xs text-muted-foreground">Nume brand / business *</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="ex: Club Q Bucharest"
            required
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Categorie</label>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {CATEGORIES.map(({ id, label, icon: I }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] ${
                  category === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <I className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Email contact *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Telefon</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="opțional"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Website</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="https://"
          />
        </div>

        <button
          disabled={saving}
          className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Salvez…" : "Creează cont"}
        </button>
        <p className="text-center text-[10px] text-muted-foreground">
          Plata pentru campanii se face per click sau per impresie, după aprobare.
        </p>
      </form>
    </>
  );
}

function AdvertiserDashboard({ adv, campaigns }: { adv: Advertiser; campaigns: AdCampaign[] }) {
  return (
    <>
      <section className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Megaphone className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{adv.brand_name}</p>
            <p className="text-xs text-muted-foreground">
              {adv.verified ? "✓ Verificat" : "În aprobare"} · {adv.category}
            </p>
          </div>
        </div>
      </section>

      <Link
        to="/advertise/new"
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 py-4 text-sm font-medium text-primary"
      >
        <Plus className="size-4" /> Campanie nouă
      </Link>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Campaniile mele
        </h3>
        {campaigns.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-4 text-center text-xs text-muted-foreground">
            Nu ai încă nicio campanie. Creează prima și ajunge la audiența ta.
          </p>
        ) : (
          <ul className="space-y-2">
            {campaigns.map((c) => (
              <li key={c.id} className="rounded-2xl border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.placement.replace("_", " ")} · {c.status}
                    </p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
                {c.cta_url && (
                  <a
                    href={c.cta_url}
                    target="_blank"
                    rel="noopener"
                    className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary"
                  >
                    {c.cta_url} <ExternalLink className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold">Cum funcționează plata?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          După ce trimiți campania, echipa Ventuza o aprobă în 24h și îți comunică pe email factura
          proforma. Plata e prin transfer bancar sau Stripe. Tarife:{" "}
          <span className="font-medium text-foreground">de la 99 RON / săptămână</span> pentru un
          banner local.
        </p>
        <a
          href="mailto:ads@ventuza.app"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
        >
          Contact direct: ads@ventuza.app
        </a>
      </section>
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-500/15 text-green-500",
    pending: "bg-amber-500/15 text-amber-500",
    paused: "bg-muted text-muted-foreground",
    ended: "bg-muted text-muted-foreground",
    rejected: "bg-red-500/15 text-red-500",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] ?? "bg-muted"}`}
    >
      {status}
    </span>
  );
}
