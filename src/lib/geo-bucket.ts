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
export function getCurrentCoords(opts?: { maxAgeMs?: number }): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation_unavailable"));
      return;
    }
    const maxAge = opts?.maxAgeMs ?? COORDS_CACHE_MS;
    if (cached && Date.now() - cached.at < maxAge) {
      resolve(cached.coords);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        cached = { at: Date.now(), coords };
        resolve(coords);
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 30_000 },
    );
  });
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
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  let last: Coords | null = null;
  const id = navigator.geolocation.watchPosition(
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
  return () => navigator.geolocation.clearWatch(id);
}
