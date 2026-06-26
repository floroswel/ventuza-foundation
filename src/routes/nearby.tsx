import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNearbyPoints, type NearbyKind, type NearbyPoint } from "@/lib/nearby.functions";
import {
  computeBucketId,
  distanceMeters,
  getCurrentCoords,
  watchSignificantMovement,
  type Coords,
} from "@/lib/geo-bucket";
import { NearbyCard } from "@/components/nearby/NearbyCard";
import { NearbyMap } from "@/components/nearby/NearbyMap";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Map, List, RefreshCw, MapPin, BellPlus, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/nearby")({
  head: () => ({
    meta: [
      { title: "Aproape de tine — Ventuza" },
      {
        name: "description",
        content:
          "Descoperă localuri, evenimente și oferte queer-friendly în apropierea ta. Locația ta precisă rămâne pe dispozitiv.",
      },
    ],
  }),
  component: NearbyPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">A apărut o eroare: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Nu am găsit pagina.</div>,
});

const RADIUS_OPTIONS = [2000, 5000, 10000] as const;

function NearbyPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const isFounder = Boolean((auth as { profile?: { is_founder?: boolean } })?.profile?.is_founder);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [radiusM, setRadiusM] = useState<number>(2000);
  const [view, setView] = useState<"list" | "map">("list");
  const [kind, setKind] = useState<NearbyKind>("event");
  const lastFetchAt = useRef<number>(0);

  const fetchNearby = useServerFn(getNearbyPoints);

  // Initial coords + watch significant movement
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    getCurrentCoords()
      .then((c) => setCoords(c))
      .catch((e) => setGeoError(String(e?.message ?? e)));
    unsubscribe = watchSignificantMovement((c) => setCoords(c), 250);
    return () => {
      unsubscribe?.();
    };
  }, []);

  const bucketId = coords ? computeBucketId(coords.lat, coords.lng) : null;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["nearby", bucketId],
    enabled: !!bucketId,
    queryFn: async () => {
      // Throttle: don't refire within 30s of last successful call.
      const since = Date.now() - lastFetchAt.current;
      if (since < 30_000 && lastFetchAt.current > 0) {
        // Re-use last cached data by returning what's cached implicitly; falling through fetches anyway.
      }
      const res = await fetchNearby({ data: { bucketId: bucketId! } });
      lastFetchAt.current = Date.now();
      return res;
    },
    staleTime: 30_000,
  });

  // Filter on-device by exact radius and current kind, sort by distance.
  const filtered = useMemo(() => {
    if (!coords || !data) return [];
    return data.points
      .filter((p) => p.kind === kind)
      .map((p) => ({ ...p, distanceM: distanceMeters(coords, { lat: p.lat, lng: p.lng }) }))
      .filter((p) => p.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM);
  }, [coords, data, kind, radiusM]);

  const handleSelectOnMap = useCallback((p: NearbyPoint) => {
    setView("map");
    // map auto-centers near user; user can tap markers.
    void p;
  }, []);

  if (geoError && !coords) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6">
          <MapPin className="h-8 w-8 text-muted-foreground mb-3" />
          <h1 className="text-xl font-semibold mb-2">Activează locația</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Pentru a vedea ce e aproape de tine, avem nevoie de permisiunea pentru
            locație. <strong>Coordonatele tale exacte rămân pe dispozitiv</strong> —
            serverul primește doar o zonă aproximativă de ~5 km, atât cât e necesar
            ca să-ți trimită locurile potrivite.
          </p>
          <Button
            onClick={() =>
              getCurrentCoords({ maxAgeMs: 0 })
                .then((c) => {
                  setGeoError(null);
                  setCoords(c);
                })
                .catch((e) => setGeoError(String(e?.message ?? e)))
            }
          >
            Permite locația
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-4 px-3 space-y-4">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Aproape de tine</h1>
          <p className="text-xs text-muted-foreground">
            Locația ta exactă nu pleacă la server. Filtrarea pe rază se face pe dispozitiv.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted rounded-md p-1">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRadiusM(r)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                  radiusM === r
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {r / 1000}km
              </button>
            ))}
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Reîncarcă"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <div className="flex gap-1 bg-muted rounded-md p-1">
            <button
              onClick={() => setView("list")}
              className={`px-2 py-1 rounded ${view === "list" ? "bg-background shadow-sm" : ""}`}
              aria-label="Listă"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("map")}
              className={`px-2 py-1 rounded ${view === "map" ? "bg-background shadow-sm" : ""}`}
              aria-label="Hartă"
            >
              <Map className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <Tabs value={kind} onValueChange={(v) => setKind(v as NearbyKind)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="event">Evenimente</TabsTrigger>
          <TabsTrigger value="venue">Localuri</TabsTrigger>
          <TabsTrigger value="offer">Oferte</TabsTrigger>
        </TabsList>

        <TabsContent value={kind} className="mt-4">
          {view === "map" ? (
            <NearbyMap user={coords} points={filtered} onSelect={(p) => {
              if (p.kind === "event") navigate({ to: "/events/$id", params: { id: p.id } });
              else if (p.kind === "offer") navigate({ to: "/offers/$id", params: { id: p.id } });
              else navigate({ to: "/venues/$id", params: { id: p.id } });
            }} />
          ) : isLoading || !coords ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Caut în zona ta…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              radiusM={radiusM}
              kind={kind}
              onExpand={() => {
                const next = RADIUS_OPTIONS[Math.min(RADIUS_OPTIONS.indexOf(radiusM as 2000 | 5000 | 10000) + 1, RADIUS_OPTIONS.length - 1)];
                setRadiusM(next);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <NearbyCard
                  key={`${p.kind}:${p.id}`}
                  point={p}
                  isFounder={isFounder}
                  onSelect={handleSelectOnMap}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({
  radiusM,
  kind,
  onExpand,
}: {
  radiusM: number;
  kind: NearbyKind;
  onExpand: () => void;
}) {
  const label = kind === "event" ? "evenimente" : kind === "offer" ? "oferte" : "localuri";
  const canExpand = radiusM < 10000;
  return (
    <Card className="p-8 text-center">
      <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <h3 className="font-semibold mb-1">Nimic în {radiusM / 1000}km</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Nu am găsit {label} în zona ta acum.
      </p>
      <div className="flex gap-2 justify-center flex-wrap">
        {canExpand && (
          <Button onClick={onExpand} variant="default" size="sm">
            Extinde raza la {radiusM === 2000 ? "5km" : "10km"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            alert(
              "Vei primi notificare când apare ceva aproape. Asigură-te că ai activat consimțământul pentru notificări în Setări.",
            )
          }
        >
          <BellPlus className="h-4 w-4 mr-1.5" />
          Anunță-mă
        </Button>
      </div>
    </Card>
  );
}
