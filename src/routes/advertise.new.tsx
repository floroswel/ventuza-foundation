import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getMyAdvertiser, type Advertiser } from "@/lib/ads";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/advertise/new")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Campanie nouă — Ventuza Ads" }, { name: "robots", content: "noindex" }],
  }),
  component: NewCampaignPage,
});

const PLACEMENTS = [
  {
    id: "events_banner",
    label: "Banner Events",
    desc: "Apare sus pe pagina /events. Recomandat cluburi/baruri.",
  },
  {
    id: "discover_card",
    label: "Card Discover",
    desc: "Apare între profile pe Discover. Recomandat branduri.",
  },
  {
    id: "event_boost",
    label: "Boost eveniment",
    desc: "Promovează un eveniment existent la vârful listei.",
  },
];

function NewCampaignPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [adv, setAdv] = useState<Advertiser | null>(null);
  const [loading, setLoading] = useState(true);

  const [placement, setPlacement] = useState("events_banner");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Află mai mult");
  const [city, setCity] = useState("");
  const [days, setDays] = useState(7);
  const [budget, setBudget] = useState(99);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    getMyAdvertiser().then((a) => {
      if (!a) navigate({ to: "/advertise" });
      else setAdv(a);
      setLoading(false);
    });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!adv) return;
    if (!title.trim()) return toast.error("Titlu obligatoriu.");
    setSaving(true);
    try {
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from("ad_campaigns").insert({
        advertiser_id: adv.id,
        placement,
        title: title.trim(),
        body: body.trim() || null,
        image_url: imageUrl.trim() || null,
        cta_url: ctaUrl.trim() || null,
        cta_label: ctaLabel.trim() || "Află mai mult",
        city: city.trim() || null,
        budget_cents: Math.round(budget * 100),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "pending",
      });
      if (error) throw error;
      toast.success("Campanie trimisă spre aprobare. Te contactăm pe email.");
      navigate({ to: "/advertise" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSaving(false);
    }
  }

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
          to="/advertise"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Megaphone className="size-4 text-primary" /> Campanie nouă
        </h1>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 px-4 py-6">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Plasament
          </label>
          <div className="mt-2 space-y-1.5">
            {PLACEMENTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlacement(p.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  placement === p.id ? "border-primary bg-primary/10" : "border-border bg-surface"
                }`}
              >
                <p className="text-sm font-medium">{p.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Field label="Titlu *">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            required
            maxLength={60}
          />
        </Field>
        <Field label="Descriere scurtă">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className={inputCls}
            maxLength={140}
          />
        </Field>
        <Field label="URL imagine (recomandat 16:9)">
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className={inputCls}
            placeholder="https://..."
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="URL destinație">
            <input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              className={inputCls}
              placeholder="https://"
            />
          </Field>
          <Field label="Text buton">
            <input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className={inputCls}
              maxLength={20}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Oraș (opțional)">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputCls}
              placeholder="Toate"
            />
          </Field>
          <Field label="Zile">
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Buget (RON)">
            <input
              type="number"
              min={50}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
          Total estimat: <span className="font-semibold text-foreground">{budget} RON</span> pentru{" "}
          {days} zile. Campania devine activă după aprobare manuală (max 24h) și plată confirmată.
        </div>

        <button
          disabled={saving}
          className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Trimit…" : "Trimite spre aprobare"}
        </button>
      </form>

      <BottomNav />
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
