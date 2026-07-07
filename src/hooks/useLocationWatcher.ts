// Refresh periodic al locației userului (foreground only) + eveniment DOM
// pentru re-fetch discover când poziția s-a schimbat semnificativ.
// - Nu forțează permisiunea; folosește doar dacă a fost deja acordată.
// - Interval min 3 min (evită dranarea bateriei).
// - Prag mișcare: 250 m (Haversine) înainte de update la server + broadcast.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const REFRESH_MS = 3 * 60 * 1000;
const MOVE_THRESHOLD_M = 250;
export const LOCATION_UPDATED_EVENT = "ventuza:location-updated";

function haversine(a: GeolocationCoordinates, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - a.latitude);
  const dLng = toRad(lng2 - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function useLocationWatcher() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let last: { lat: number; lng: number } | null = null;

    async function permissionGranted(): Promise<boolean> {
      try {
        // Verifică permisiunea fără a o cere activ (evită prompt-uri).
        const perms = (navigator as Navigator & {
          permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> };
        }).permissions;
        if (!perms?.query) return true; // nu putem verifica → încercăm oricum
        const st = await perms.query({ name: "geolocation" as PermissionName });
        return st.state === "granted";
      } catch {
        return true;
      }
    }

    function getPos(): Promise<GeolocationPosition | null> {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
        );
      });
    }

    async function tick() {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (!(await permissionGranted())) return;
      const pos = await getPos();
      if (!pos) return;
      const { latitude, longitude } = pos.coords;
      if (last) {
        const moved = haversine(pos.coords, last.lat, last.lng);
        if (moved < MOVE_THRESHOLD_M) return;
      }
      last = { lat: latitude, lng: longitude };
      try {
        await supabase.rpc("update_my_location", { lng: longitude, lat: latitude });
        window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT));
      } catch {
        /* silent — network glitch */
      }
    }

    function start() {
      if (timer) return;
      void tick();
      timer = setInterval(() => void tick(), REFRESH_MS);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }
    function onVis() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user]);
}
