// Refresh periodic al locației userului (foreground only) + eveniment DOM
// pentru re-fetch discover când poziția s-a schimbat semnificativ.
// - Nu forțează permisiunea; folosește doar dacă a fost deja acordată.
// - Interval min 3 min (evită dranarea bateriei).
// - Prag mișcare: 250 m (Haversine) înainte de update la server + broadcast.
// - Respectă `profiles.location_sharing_enabled` + gate-ul de țară.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCountryGate } from "@/lib/country-gate";
import { getCurrentPosition, type Position } from "@/lib/native-geolocation";

const REFRESH_MS = 3 * 60 * 1000;
const MOVE_THRESHOLD_M = 250;
export const LOCATION_UPDATED_EVENT = "suzeta:location-updated";

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function useLocationWatcher() {
  const { user } = useAuth();
  const { forceStealth, hidePreciseLocation, isBlocked } = useCountryGate();
  const [sharingEnabled, setSharingEnabled] = useState<boolean | null>(null);

  // Fetch inițial + resync la fiecare 60s (evită canal realtime dedicat care
  // ar cere alt topic în whitelist-ul de authz).
  useEffect(() => {
    if (!user) {
      setSharingEnabled(null);
      return;
    }
    let cancelled = false;
    async function fetchFlag() {
      const { data } = await supabase
        .from("profiles")
        .select("location_sharing_enabled")
        .eq("id", user!.id)
        .maybeSingle();
      if (cancelled) return;
      setSharingEnabled(data?.location_sharing_enabled !== false);
    }
    void fetchFlag();
    const t = setInterval(() => void fetchFlag(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (forceStealth || hidePreciseLocation || isBlocked) return;
    if (sharingEnabled !== true) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let last: { lat: number; lng: number } | null = null;

    async function tick() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const pos: Position | null = await getCurrentPosition({
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 15_000,
      });
      if (!pos) return;
      const { latitude, longitude } = pos.coords;
      if (last && haversine(last.lat, last.lng, latitude, longitude) < MOVE_THRESHOLD_M) return;
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
  }, [user, sharingEnabled, forceStealth, hidePreciseLocation, isBlocked]);
}
