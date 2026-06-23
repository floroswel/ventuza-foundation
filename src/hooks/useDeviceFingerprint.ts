import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeDeviceFingerprint } from "@/lib/fingerprint";

/**
 * Registers the current browser fingerprint to the signed-in user.
 * Runs once per session. If the device has been banned, signs the user out.
 */
export function useDeviceFingerprint() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const fp = await computeDeviceFingerprint();
        if (cancelled) return;
        // Block pre-check (avoid noise if already banned)
        const { data: banned } = await supabase.rpc("is_fingerprint_banned", { _fp: fp });
        if (banned) {
          await supabase.auth.signOut();
          if (typeof window !== "undefined") window.location.href = "/auth?banned=1";
          return;
        }
        await supabase.rpc("register_device_fingerprint", {
          _fp: fp,
          _ua: navigator.userAgent.slice(0, 500),
        });
      } catch {
        // best-effort; never block UX
      }
    })();
    return () => { cancelled = true; };
  }, []);
}
