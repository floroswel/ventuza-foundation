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

  return null;
}
