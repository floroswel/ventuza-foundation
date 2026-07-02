/**
 * Proximity watcher — STRAT 1 (foreground only).
 *
 * Rulează în root, doar când userul e autentificat și e cu app-ul deschis.
 * - Folosește `watchSignificantMovement` (≥250m) pentru a evita drain.
 * - Refolosește lista cached `nearby_points` din React Query (cheia `["nearby", bucketId]`),
 *   altfel re-fetch o singură dată per bucket.
 * - Calculează distanța pe DEVICE (Haversine). Coordonatele NU pleacă la server.
 * - Pentru fiecare punct (venue/event) sub `radius_m` (default 2000m), apelează
 *   server-side `recordProximityHit` care decide dacă afișează — toate gate-urile
 *   de anti-spam, quiet hours, cooldown sunt în SQL.
 * - Dacă serverul răspunde `allowed=true`, afișăm notificare locală (Notification API
 *   în browser; pe mobil Capacitor avem fallback la toast — fără persistență trasee).
 *
 * NU stocăm istoric de poziții. Single in-memory set previne re-trigger la
 * același tick.
 */
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import {
  computeBucketId,
  distanceMeters,
  getCurrentCoords,
  watchSignificantMovement,
  type Coords,
} from "@/lib/geo-bucket";
import { getNearbyPoints, type NearbyPoint } from "@/lib/nearby.functions";
import { recordProximityHit } from "@/lib/proximity.functions";
import { useCountryGate } from "@/lib/country-gate";

const DEFAULT_RADIUS_M = 2000;
// Avoid double-triggering during the same session (server still enforces
// cooldown across sessions / devices).
const sessionFiredThisSession = new Set<string>();

function showLocalNotification(title: string, body: string) {
  try {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/icon-192.png",
        silent: false,
      });
      return;
    }
  } catch {
    /* ignore */
  }
  // Fallback: lightweight in-app toast via sonner (loaded dynamically to avoid SSR).
  import("sonner").then(({ toast }) => toast(title, { description: body })).catch(() => {});
}

export function useProximityForegroundWatcher() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;
  const fetchNearby = useServerFn(getNearbyPoints);
  const recordHit = useServerFn(recordProximityHit);
  const pointsCacheRef = useRef<Map<string, NearbyPoint[]>>(new Map());
  // Country gate: în țări high/blocked nu rulăm proximity foreground —
  // proximity notifications ar putea expune userul (outing prin push preview).
  const { forceStealth, hidePreciseLocation, isBlocked, isDiscoverDisabled } = useCountryGate();

  useEffect(() => {
    if (!userId) return;
    if (forceStealth || hidePreciseLocation || isBlocked || isDiscoverDisabled) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let stopped = false;

    async function checkAt(coords: Coords) {
      if (stopped) return;
      const bucketId = computeBucketId(coords.lat, coords.lng);
      let points = pointsCacheRef.current.get(bucketId);
      if (!points) {
        try {
          const res = await fetchNearby({ data: { bucketId, kinds: ["venue", "event"] } });
          points = res.points;
          pointsCacheRef.current.set(bucketId, points);
        } catch {
          return;
        }
      }
      for (const p of points) {
        if (p.kind !== "venue" && p.kind !== "event") continue;
        const d = distanceMeters(coords, { lat: p.lat, lng: p.lng });
        if (d > DEFAULT_RADIUS_M) continue;
        const dedupeKey = `${p.kind}:${p.id}`;
        if (sessionFiredThisSession.has(dedupeKey)) continue;
        sessionFiredThisSession.add(dedupeKey);
        try {
          const res = await recordHit({
            data: { pointKind: p.kind, pointId: p.id, layer: "foreground" },
          });
          if (res.allowed) {
            const distLabel =
              d < 950 ? `${Math.round(d / 10) * 10}m` : `${(d / 1000).toFixed(1)}km`;
            showLocalNotification(
              p.name,
              p.kind === "event"
                ? `Eveniment la ${distLabel} de tine`
                : `Local queer-friendly la ${distLabel}`,
            );
          }
        } catch {
          /* swallow — server gate is best-effort UX */
        }
      }
    }

    // Initial check
    getCurrentCoords()
      .then(checkAt)
      .catch(() => {});
    const stopWatcher = watchSignificantMovement((c) => void checkAt(c), 250);
    return () => {
      stopped = true;
      stopWatcher();
    };
  }, [userId, fetchNearby, recordHit, forceStealth, hidePreciseLocation, isBlocked, isDiscoverDisabled]);
}
