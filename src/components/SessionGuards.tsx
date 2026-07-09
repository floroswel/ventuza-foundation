import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCountryGate } from "@/lib/country-gate";
import { watchPosition, type WatchHandle } from "@/lib/native-geolocation";

// Routes a not-yet-onboarded user is allowed to land on. Everything else is
// hard-redirected to /n so OAuth signups cannot reach the app without supplying
// a real birthdate (server-side `enforce_min_age_trg` enforces 18+).
const ALLOWED_WITHOUT_BIRTHDATE = ["/n", "/auth", "/age-gate", "/legal", "/r/"];

// Routes a user whose email isn't confirmed can still land on. The rest of the
// app gates server-side via `assert_account_usable()` — this redirect is just
// UX so the user lands somewhere actionable (resend link) instead of hitting
// `email_not_confirmed` errors on every social RPC.
const ALLOWED_WITHOUT_EMAIL_CONFIRMED = ["/auth", "/legal", "/reset-password", "/account-deletion"];

/** Invisible component that wires session-scoped background guards. */
export function SessionGuards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const geoWatchRef = useRef<WatchHandle | null>(null);
  const lastSentRef = useRef(0);
  const { forceStealth, hidePreciseLocation, isBlocked } = useCountryGate();
  const [sharingEnabled, setSharingEnabled] = useState<boolean | null>(null);

  // Ține sincron flag-ul `location_sharing_enabled` din profil (fetch inițial +
  // realtime UPDATE). Când userul îl oprește din Profil, watch-ul se închide
  // instant fără reload.
  useEffect(() => {
    if (!user) {
      setSharingEnabled(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("location_sharing_enabled")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSharingEnabled(data?.location_sharing_enabled !== false);
      });
    const chan = supabase
      .channel(`profile-loc-share:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const next = (payload.new as { location_sharing_enabled?: boolean | null } | null)
            ?.location_sharing_enabled;
          setSharingEnabled(next !== false);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(chan);
    };
  }, [user]);

  useDeviceFingerprint();

  // Email-confirmation guard. OAuth providers (Google/Apple) auto-confirm so
  // this affects only email/password signups that bypass the check-email step.
  useEffect(() => {
    if (!user) return;
    const path = location.pathname || "/";
    const exempt = ALLOWED_WITHOUT_EMAIL_CONFIRMED.some((p) => path.startsWith(p));
    if (exempt) return;
    // `email_confirmed_at` lives on auth.users; the client User object exposes it.
    const confirmedAt = (user as unknown as { email_confirmed_at?: string | null })
      .email_confirmed_at;
    if (!confirmedAt && user.email) {
      navigate({ to: "/auth/check-email", search: { email: user.email }, replace: true });
    }
  }, [user, location.pathname, navigate]);

  // Birthdate / onboarding guard — must run on every navigation while signed in.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("birthdate, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const path = location.pathname || "/";
      const exempt = ALLOWED_WITHOUT_BIRTHDATE.some((p) => path.startsWith(p));
      if (!data?.birthdate && !exempt) {
        navigate({ to: "/n", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    if (!user) return;
    if (forceStealth || hidePreciseLocation || isBlocked) return;
    if (sharingEnabled !== true) return;

    let cancelled = false;
    void (async () => {
      const handle = await watchPosition(
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
      if (cancelled) handle.clear();
      else geoWatchRef.current = handle;
    })();
    return () => {
      cancelled = true;
      geoWatchRef.current?.clear();
      geoWatchRef.current = null;
    };
  }, [user, forceStealth, hidePreciseLocation, isBlocked, sharingEnabled]);

  return null;
}
