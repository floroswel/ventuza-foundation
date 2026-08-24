// Onboarding pentru permisiunea de locație + FALLBACK manual pe oraș.
//
// Motiv: pe Android, dacă userul refuză permisiunea (sau GPS-ul e indisponibil),
// Discover și Nearby rămâneau complet goale, fără cale de ieșire. Aici oferim:
//   1. explicație scurtă de privacy,
//   2. buton nativ „Permite locația" (+ deschidere Setări dacă e blocată),
//   3. fallback: alegi orașul → trimitem centrul orașului ca zonă aproximativă.
//
// REGULĂ LOCAȚIE: nu afișăm și nu stocăm coordonate ale altor useri. Centrul de
// oraș e o constantă publică, nu poziția reală a userului.
import { useState } from "react";
import { MapPin, Loader2, Settings2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requestAndStoreLocation } from "@/lib/discover";
import { Button } from "@/components/ui/button";

/** Centre aproximative de oraș (sursă publică). Doar ca zonă, nu poziție reală. */
export const CITY_CENTERS: Array<{ name: string; lat: number; lng: number }> = [
  { name: "București", lat: 44.4268, lng: 26.1025 },
  { name: "Cluj-Napoca", lat: 46.7712, lng: 23.6236 },
  { name: "Timișoara", lat: 45.7489, lng: 21.2087 },
  { name: "Iași", lat: 47.1585, lng: 27.6014 },
  { name: "Constanța", lat: 44.1598, lng: 28.6348 },
  { name: "Brașov", lat: 45.6427, lng: 25.5887 },
  { name: "Craiova", lat: 44.3302, lng: 23.7949 },
  { name: "Sibiu", lat: 45.7983, lng: 24.1256 },
  { name: "Oradea", lat: 47.0465, lng: 21.9189 },
  { name: "Galați", lat: 45.4353, lng: 28.008 },
];

export function LocationOnboarding({
  onDone,
  compact = false,
}: {
  onDone?: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<null | "gps" | "city">(null);
  const [showCities, setShowCities] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  async function askGps() {
    setBusy("gps");
    try {
      const r = await requestAndStoreLocation();
      if (r.ok) {
        toast.success("Locația a fost activată");
        onDone?.();
        return;
      }
      toast.error(r.error ?? "Locația nu a fost activată");
      setShowCities(true);
    } finally {
      setBusy(null);
    }
  }

  async function openSettings() {
    const { openLocationSettings } = await import("@/lib/native-geolocation");
    const opened = await openLocationSettings();
    if (!opened) {
      toast.message("Deschide manual Setări → Aplicații → Suzeta → Permisiuni → Locație");
    }
  }

  async function pickCity(city: { name: string; lat: number; lng: number }) {
    setBusy("city");
    try {
      const { error } = await supabase.rpc("update_my_location", {
        lng: city.lng,
        lat: city.lat,
      });
      if (error) throw error;
      setPicked(city.name);
      toast.success(`Zonă setată: ${city.name}`, {
        description: "Poți activa GPS-ul oricând pentru rezultate mai apropiate.",
      });
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message ?? "Nu am putut salva zona");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-left">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-medium">De ce cerem locația</p>
            <p className="text-xs text-muted-foreground">
              Ca să-ți arătăm oameni și locuri din apropiere. Trimitem serverului doar o zonă
              aproximativă, iar distanțele sunt afișate în intervale („&lt; 1 km", „~ 4 km") —
              niciodată coordonate exacte.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="hero" onClick={askGps} disabled={busy !== null}>
          {busy === "gps" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Permite locația
        </Button>
        <Button variant="outline" onClick={() => setShowCities((v) => !v)} disabled={busy !== null}>
          Nu am GPS — alege orașul
        </Button>
        <Button variant="ghost" onClick={openSettings} disabled={busy !== null}>
          <Settings2 className="mr-2 size-4" /> Setări
        </Button>
      </div>

      {showCities && (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Alege orașul în care ești. Folosim doar centrul orașului ca zonă aproximativă.
          </p>
          <div className="flex flex-wrap gap-2">
            {CITY_CENTERS.map((c) => (
              <button
                key={c.name}
                type="button"
                disabled={busy !== null}
                onClick={() => pickCity(c)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/60 disabled:opacity-50"
              >
                {picked === c.name && <Check className="size-3 text-primary" />}
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
