import { DEFAULT_FILTERS, type DiscoverFilters } from "@/lib/discover";

/**
 * Persistent Discover filters.
 *
 * Restricted by design: NO Art. 9 data (HIV status, orientation, gender identity).
 * Doar câmpuri "safe" pentru re-load automat între sesiuni:
 *   - maxDistanceKm, minAge, maxAge
 *   - minHeight, maxHeight
 *   - tribes, bodyTypes, positions
 *   - lookingNowOnly, verifiedOnly, withPhotoOnly, onlineOnly
 *
 * Explicit EXCLUDED (nu se persistă):
 *   - orientation (Art. 9)
 *   - gender (Art. 9 pe app queer)
 *   - lookingFor (poate revela intent sexual — nu îl salvăm între sesiuni)
 */

const SAFE_KEYS = [
  "maxDistanceKm",
  "minAge",
  "maxAge",
  "minHeight",
  "maxHeight",
  "tribes",
  "bodyTypes",
  "positions",
  "lookingNowOnly",
  "verifiedOnly",
  "withPhotoOnly",
  "onlineOnly",
] as const satisfies ReadonlyArray<keyof DiscoverFilters>;

type SafeKey = (typeof SAFE_KEYS)[number];
type PersistedFilters = Partial<Pick<DiscoverFilters, SafeKey>>;

function storageKey(userId: string) {
  return `vz_discover_filters:${userId}`;
}

function pickSafe(f: DiscoverFilters): PersistedFilters {
  const out: PersistedFilters = {};
  for (const k of SAFE_KEYS) {
    // @ts-expect-error index assignment across union keeps k typed
    out[k] = f[k];
  }
  return out;
}

export function loadDiscoverFilters(userId: string | undefined): DiscoverFilters {
  if (!userId || typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as PersistedFilters;
    const merged: DiscoverFilters = { ...DEFAULT_FILTERS };
    for (const k of SAFE_KEYS) {
      if (parsed[k] !== undefined) {
        // @ts-expect-error safe: key is in SAFE_KEYS
        merged[k] = parsed[k];
      }
    }
    // Sanity clamps
    if (merged.minAge < 18) merged.minAge = 18;
    if (merged.maxAge < merged.minAge) merged.maxAge = merged.minAge;
    if (merged.maxDistanceKm < 1) merged.maxDistanceKm = 1;
    if (merged.maxDistanceKm > 5000) merged.maxDistanceKm = 5000;
    return merged;
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveDiscoverFilters(userId: string | undefined, filters: DiscoverFilters) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(pickSafe(filters)));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function resetDiscoverFilters(userId: string | undefined): DiscoverFilters {
  if (userId && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(storageKey(userId));
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_FILTERS;
}
