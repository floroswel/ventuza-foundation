/**
 * Geo bucketing — CLIENT SIDE ONLY.
 *
 * Strict GDPR rule (AGENTS.md): user precise coordinates MUST NOT leave the device.
 * The server only ever sees a bucket id (≈5km grid cell) that the client computes
 * locally. Filtering at exact radius (≤2/5/10 km) and distance display happen on
 * the device using Haversine.
 */

export type Coords = { lat: number; lng: number };

const BUCKET_SCALE = 20; // floor(lat*20) → ~5.5km lat per cell

export function computeBucketId(lat: number, lng: number): string {
  return `${Math.floor(lat * BUCKET_SCALE)}:${Math.floor(lng * BUCKET_SCALE)}`;
}

// Haversine — distance in meters between two points on Earth.
export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 950) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

const COORDS_CACHE_MS = 60_000;
let cached: { at: number; coords: Coords } | null = null;

/**
 * Get the user's current coordinates. Stays in memory only.
 * Never persist these to localStorage or send to a server.
 */
export type GeoErrorCode = "unavailable" | "denied" | "position_unavailable" | "timeout";

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "GeoError";
  }
}

export async function getCurrentCoords(opts?: { maxAgeMs?: number }): Promise<Coords> {
  const maxAge = opts?.maxAgeMs ?? COORDS_CACHE_MS;
  if (cached && Date.now() - cached.at < maxAge) return cached.coords;
  const { getCurrentPosition } = await import("./native-geolocation");
  const pos = await getCurrentPosition({ enableHighAccuracy: false, timeout: 15_000, maximumAge: 30_000 });
  if (!pos) {
    throw new GeoError(
      "denied",
      "Locația nu e disponibilă. Verifică permisiunile aplicației (Setări → Aplicații → Ventuza → Permisiuni → Locație).",
    );
  }
  const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  cached = { at: Date.now(), coords };
  return coords;
}


export function clearCoordsCache() {
  cached = null;
}

/**
 * Watch for significant movement (≥thresholdM meters). Calls cb with new coords
 * each time the user moves enough to matter. Returns an unsubscribe fn.
 */
export function watchSignificantMovement(
  cb: (coords: Coords) => void,
  thresholdM = 250,
): () => void {
  let cancelled = false;
  let handle: { clear: () => void } | null = null;
  let last: Coords | null = null;
  void (async () => {
    const { watchPosition } = await import("./native-geolocation");
    if (cancelled) return;
    handle = await watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!last || distanceMeters(last, coords) >= thresholdM) {
          last = coords;
          cached = { at: Date.now(), coords };
          cb(coords);
        }
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 30_000 },
    );
    if (cancelled) handle?.clear();
  })();
  return () => {
    cancelled = true;
    handle?.clear();
  };
}
