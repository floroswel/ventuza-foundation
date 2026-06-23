import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/** Invisible component that wires session-scoped background guards. */
export function SessionGuards() {
  const { user } = useAuth();
  const geoWatchRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useDeviceFingerprint();

  useEffect(() => {
    if (!user || !("geolocation" in navigator)) return;

    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < 15_000) return;
        lastSentRef.current = now;
        void supabase.rpc("update_my_location", {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );

    return () => {
      if (geoWatchRef.current != null) navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    };
  }, [user]);

  return null;
}
