import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

// Routes a not-yet-onboarded user is allowed to land on. Everything else is
// hard-redirected to /n so OAuth signups cannot reach the app without supplying
// a real birthdate (server-side `enforce_min_age_trg` enforces 18+).
const ALLOWED_WITHOUT_BIRTHDATE = ["/n", "/auth", "/age-gate", "/legal", "/r/"];

// Routes a user whose email isn't confirmed can still land on. The rest of the
// app gates server-side via `assert_account_usable()` — this redirect is just
// UX so the user lands somewhere actionable (resend link) instead of hitting
// `email_not_confirmed` errors on every social RPC.
const ALLOWED_WITHOUT_EMAIL_CONFIRMED = ["/auth", "/legal", "/reset-password", "/account-deletion"];

/**
 * Invisible component that wires session-scoped background guards.
 *
 * Notă: watch-ul de locație rulează EXCLUSIV prin `useLocationWatcher` (montat
 * în `__root.tsx`). Nu duplicăm aici — două watchere paralele cu praguri
 * diferite dublau traficul RPC și creau race conditions pe update_my_location.
 */
export function SessionGuards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useDeviceFingerprint();

  // Sesiune fantomă (user șters server-side / refresh token revocat) → curățăm
  // local și trimitem la /auth, altfel app-ul rămâne blocat în 403/409.
  useEffect(() => {
    void (async () => {
      console.log("[AUTH] GUARD_SESSION_RESTORE_STARTED");
      try {
        const { reapStaleSession } = await import("@/lib/stale-session");
        await reapStaleSession();
        console.log("[AUTH] GUARD_SESSION_RESTORE_FINISHED", { err: null });
      } catch (err) {
        console.log("[AUTH] GUARD_SESSION_RESTORE_FINISHED", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, []);



  // Gate-ul de confirmare email a fost ELIMINAT: „Confirm email” e dezactivat
  // în backend, identitatea se verifică prin Didit în onboarding. Un user cu
  // sesiune validă merge direct la onboarding.


  // Birthdate / onboarding guard — must run on every navigation while signed in.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      console.log("[AUTH] GUARD_ONBOARDING_FETCH_STARTED", { path: location.pathname });
      const { data, error } = await supabase
        .from("profiles")
        .select("birthdate, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      console.log("[AUTH] GUARD_ONBOARDING_FETCH_FINISHED", {
        err: error ? { code: error.code, msg: error.message } : null,
        rowPresent: !!data,
        birthdatePresent: !!data?.birthdate,
        onboarding_completed: data?.onboarding_completed ?? null,
      });
      if (cancelled) return;
      const path = location.pathname || "/";
      const exempt = ALLOWED_WITHOUT_BIRTHDATE.some((p) => path.startsWith(p));
      if (!data?.birthdate && !exempt) {
        console.log("[AUTH] NAVIGATION_STARTED", { to: "/n", reason: "missing_birthdate" });
        navigate({ to: "/n", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname, navigate]);

  return null;
}
