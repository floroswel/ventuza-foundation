import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Globe, Plane, Ticket, Users, Search, Plus, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { getExploreCities, type ExploreCity } from "@/lib/explore.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explore")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Explore — Ventuza" },
      {
        name: "description",
        content:
          "Descoperă evenimente queer-friendly și orașe unde comunitatea Ventuza e activă. Călătorești? Găsești imediat unde să te conectezi.",
      },
    ],
  }),
  component: ExplorePage,
});

type Tab = "events" | "venture";

function ExplorePage() {
  const [tab, setTab] = useState<Tab>("venture");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const fetchCities = useServerFn(getExploreCities);
  const { data, isLoading, error } = useQuery({
    queryKey: ["explore-cities"],
    queryFn: () => fetchCities({}),
    staleTime: 60_000,
  });

  const cities = (data ?? []) as ExploreCity[];
  const filtered = query
    ? cities.filter((c) => c.city.toLowerCase().includes(query.toLowerCase()))
    : cities;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="relative overflow-hidden px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/25 via-background to-background" />
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Explore</h1>
          <div className="flex items-center gap-2">
            <button
              aria-label="Caută oraș"
              onClick={() => document.getElementById("explore-search")?.focus()}
              className="grid size-10 place-items-center rounded-full border border-border/60 bg-background/60 backdrop-blur"
            >
              <Search className="size-4" />
            </button>
            <Link
              to="/settings"
              aria-label="Travel mode"
              className="grid size-10 place-items-center rounded-full border border-border/60 bg-background/60 backdrop-blur"
            >
              <Plane className="size-4" />
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-6 border-b border-border/60">
          {(["events", "venture"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 pb-2 text-sm font-semibold uppercase tracking-wide transition-colors",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {t === "events" ? "Events" : "Venture"}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Search */}
        <div className="mb-4 flex items-center gap-2 rounded-full border border-border/60 bg-surface px-4 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            id="explore-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "venture" ? "Caută oraș…" : "Caută eveniment…"}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {tab === "events" ? <EventsPanel /> : (
          <VenturePanel
            cities={filtered}
            loading={isLoading}
            error={error as Error | null}
            onOpen={() => navigate({ to: "/events" })}
          />
        )}
      </div>

      {/* Floating add — parteneri creează local/eveniment */}
      <Link
        to="/partner"
        aria-label="Adaugă"
        className="fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_var(--primary)]"
      >
        <Plus className="size-6" />
      </Link>

      <BottomNav />
    </div>
  );
}

function EventsPanel() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-6 text-center">
      <Ticket className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Vezi toate evenimentele</p>
      <p className="text-xs text-muted-foreground">RSVP, hărți, oferte partenere.</p>
      <Link
        to="/events"
        className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Deschide Events
      </Link>
    </div>
  );
}

function VenturePanel({
  cities,
  loading,
  error,
  onOpen,
}: {
  cities: ExploreCity[];
  loading: boolean;
  error: Error | null;
  onOpen: () => void;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Nu am putut încărca orașele: {error.message}
      </div>
    );
  }
  if (cities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-6 text-center">
        <Globe className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Nu sunt încă orașe active</p>
        <p className="text-xs text-muted-foreground">
          Comunitatea crește. Când parteneri publică venues sau useri activează travel, orașele apar aici.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {cities.map((c) => (
        <CityCard key={c.city} city={c} onOpen={() => onOpen(c.city)} />
      ))}
    </div>
  );
}

function CityCard({ city, onOpen }: { city: ExploreCity; onOpen: () => void }) {
  const hue = hashHue(city.city);
  return (
    <button
      onClick={onOpen}
      className="group relative block h-56 w-full overflow-hidden rounded-2xl border border-border/50 text-left"
    >
      {city.cover_url ? (
        <img
          src={city.cover_url}
          alt={city.city}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 70% 45%) 0%, hsl(${(hue + 60) % 360} 70% 30%) 100%)`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
        <h3 className="text-2xl font-bold text-white drop-shadow">{city.city}</h3>
        <div className="flex flex-col items-end gap-1">
          {city.travelers > 0 && (
            <Chip icon={<Plane className="size-3.5" />} label={city.travelers} />
          )}
          {city.events > 0 && (
            <Chip icon={<Ticket className="size-3.5" />} label={city.events} />
          )}
          {city.venues > 0 && (
            <Chip icon={<Users className="size-3.5" />} label={city.venues} />
          )}
        </div>
      </div>
    </button>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
      {label}
      {icon}
    </span>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
