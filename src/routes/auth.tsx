import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TurnstileWidget, isTurnstileConfigured } from "@/components/TurnstileWidget";
import { Label } from "@/components/ui/label";
import { mapAuthError, type FriendlyAuthError } from "@/lib/auth-errors";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).catch("login"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Ventuza" },
      { name: "description", content: "Sign in or create your Ventuza account." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "Max 72 characters");

async function persistPendingBirthdate(userId: string) {
  if (typeof window === "undefined") return;
  // sessionStorage poate fi pierdut între contexte (Safari ASWebAuthSession,
  // browser extern pe mobil). Citim din ambele și ștergem după.
  let pending: string | null = null;
  try { pending = sessionStorage.getItem("vz_pending_birthdate"); } catch { /* ignore */ }
  if (!pending) {
    try { pending = localStorage.getItem("vz_pending_birthdate"); } catch { /* ignore */ }
  }
  if (!pending) return;
  try {
    await supabase.from("profiles").update({ birthdate: pending }).eq("id", userId);
  } catch { /* ignore */ }
  try { sessionStorage.removeItem("vz_pending_birthdate"); } catch { /* ignore */ }
  try { localStorage.removeItem("vz_pending_birthdate"); } catch { /* ignore */ }
}


async function routeAfterAuth(userId: string, navigate: ReturnType<typeof useNavigate>, redirectTo?: string) {
  if (redirectTo && redirectTo.startsWith("/")) {
    navigate({ to: redirectTo, replace: true });
    return;
  }
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed, birthdate")
    .eq("id", userId)
    .maybeSingle();
  // OAuth signups may not have a birthdate yet — SessionGuards also enforces
  // this, but we route directly to /n to avoid a flash of /discover.
  if (!data?.birthdate) {
    navigate({ to: "/n", replace: true });
    return;
  }
  // Default landing for returning users is /discover (the main feed).
  // /cruise is the opt-in "Right Now" feed and used to be a confusing default.
  if (data?.onboarding_completed) navigate({ to: "/discover", replace: true });
  else navigate({ to: "/n", replace: true });
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(search.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [over18, setOver18] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "apple" | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [authError, setAuthError] = useState<FriendlyAuthError | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const captchaRequired = isTurnstileConfigured();

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const t = setTimeout(() => setRetryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [retryCountdown]);

  function handleAuthError(err: unknown) {
    const mapped = mapAuthError(err);
    setAuthError(mapped);
    if (mapped.retryAfterSec) setRetryCountdown(mapped.retryAfterSec);
    if (mapped.resetCaptcha) {
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
    }
    toast.error(mapped.message);
  }

  useEffect(() => {
    if (!authLoading && user) {
      void (async () => {
        // Catch OAuth round-trips that landed back on /auth.
        await persistPendingBirthdate(user.id);
        await routeAfterAuth(user.id, navigate, search.redirect);
      })();
    }
  }, [authLoading, user, navigate, search.redirect]);

  function ageFromBirthDate(iso: string): number | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  }

  const signupDisabled = mode === "signup" && (!over18 || !acceptTerms || (ageFromBirthDate(birthDate) ?? 0) < 18);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      toast.error(emailParsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    const passParsed = passwordSchema.safeParse(password);
    if (!passParsed.success) {
      toast.error(passParsed.error.issues[0]?.message ?? "Invalid password");
      return;
    }

    if (captchaRequired && !captchaToken) {
      handleAuthError(new Error("captcha required"));
      return;
    }
    setAuthError(null);

    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (!over18 || !acceptTerms) {
          toast.error("Please confirm the two checkboxes to continue.");
          return;
        }
        const age = ageFromBirthDate(birthDate);
        if (age === null) {
          toast.error("Te rog introdu data nașterii.");
          return;
        }
        if (age < 18) {
          toast.error("Trebuie să ai cel puțin 18 ani pentru a folosi Ventuza.");
          return;
        }
        // Server-side disposable email preflight (enforced again by DB trigger
        // public.enforce_disposable_email_on_profile).
        const { error: disposableErr } = await supabase.rpc("assert_email_allowed", {
          _email: emailParsed.data,
        });
        if (disposableErr) {
          handleAuthError(disposableErr);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: emailParsed.data,
          password: passParsed.data,
          options: {
            emailRedirectTo: `${window.location.origin}/n`,
            captchaToken: captchaToken ?? undefined,
          },
        });
        if (error) {
          handleAuthError(error);
          return;
        }
        // Persist birthdate on profile (trigger `enforce_min_age` enforces 18+ server-side).
        // Canonical column is `birthdate` — used by age gate, discover, /n onboarding.
        if (data.user) {
          await supabase
            .from("profiles")
            .update({ birthdate: birthDate })
            .eq("id", data.user.id);
        }
        if (data.session) {
          toast.success("Welcome to Ventuza.");
          await routeAfterAuth(data.user!.id, navigate);
        } else {
          // Email confirmation required → ghidăm userul către o pagină dedicată
          // cu resend + countdown (nu îl lăsăm blocat pe /auth fără feedback).
          navigate({ to: "/auth/check-email", search: { email: emailParsed.data }, replace: true });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailParsed.data,
          password: passParsed.data,
          options: { captchaToken: captchaToken ?? undefined },
        });
        if (error) {
          handleAuthError(error);
          return;
        }
        if (data.user) await routeAfterAuth(data.user.id, navigate, search.redirect);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onOAuth(provider: "google" | "apple") {
    if (provider === "signup-blocked" as never) return;
    if (mode === "signup") {
      if (!over18 || !acceptTerms) {
        toast.error("Confirmă cele două bife (18+ și Termeni) înainte de a continua.");
        return;
      }
      // Require a real birthdate before OAuth signup. The trigger
      // `enforce_min_age_trg` cannot reject NULL, so we enforce here too.
      const age = ageFromBirthDate(birthDate);
      if (age === null) {
        toast.error("Introdu data nașterii înainte de a continua cu Google/Apple.");
        return;
      }
      if (age < 18) {
        toast.error("Trebuie să ai cel puțin 18 ani.");
        return;
      }
      // Persist în ambele storage-uri ca să supraviețuiască redirect-ului OAuth
      // (sessionStorage e pierdut pe Safari/WebView; localStorage rămâne).
      try { sessionStorage.setItem("vz_pending_birthdate", birthDate); } catch { /* ignore */ }
      try { localStorage.setItem("vz_pending_birthdate", birthDate); } catch { /* ignore */ }

    }
    setOauthBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error(result.error.message ?? `${provider} sign-in failed`);
        return;
      }
      if (result.redirected) return; // browser navigates
      // session set in place
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await persistPendingBirthdate(data.user.id);
        await routeAfterAuth(data.user.id, navigate, search.redirect);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${provider} sign-in failed`);
    } finally {
      setOauthBusy(null);
    }
  }

  async function onForgotPassword() {
    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      toast.error("Enter your email above first.");
      return;
    }
    if (captchaRequired && !captchaToken) {
      handleAuthError(new Error("captcha required"));
      return;
    }
    setAuthError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(emailParsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: captchaToken ?? undefined,
    });
    if (error) {
      handleAuthError(error);
    } else {
      toast.success("Email cu link de resetare trimis.");
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
        <Link to="/" className="self-start text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-primary">
          ← Back
        </Link>

        <div className="mt-10 text-center">
          <h1 className="wordmark text-5xl font-medium leading-none">Ventuza</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-8 grid grid-cols-2 gap-1 rounded-full border border-border bg-surface p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                "rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors " +
                (mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        {/* OAuth */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => onOAuth("google")}
            disabled={oauthBusy !== null || submitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
          >
            {oauthBusy === "google" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.6 14.6 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12s4.2 9.3 9.3 9.3c5.4 0 8.9-3.8 8.9-9.1 0-.6-.1-1.1-.2-1.6H12z"/>
              </svg>
            )}
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => onOAuth("apple")}
            disabled={oauthBusy !== null || submitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
          >
            {oauthBusy === "apple" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.4-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2-.1 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.3.9-1.3 1.2-2.6 1.3-2.7-.1 0-2.4-.9-2.4-3.7zM14.4 5.6c.6-.8 1.1-1.9 1-3-1 .1-2.1.7-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z"/>
              </svg>
            )}
            Continue with Apple
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">or with email</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                placeholder="you@domain.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {mode === "login" && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
              >
                Forgot password?
              </button>
            )}
          </div>

          {mode === "signup" && (
            <div className="space-y-3 rounded-xl border border-border bg-surface/60 p-4">
              <div>
                <Label htmlFor="birthdate" className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Data nașterii
                </Label>
                <Input
                  id="birthdate"
                  type="date"
                  required
                  max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full"
                />
                {birthDate && (ageFromBirthDate(birthDate) ?? 0) < 18 && (
                  <p className="mt-1 text-xs text-destructive">Trebuie să ai cel puțin 18 ani.</p>
                )}
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={over18}
                  onChange={(e) => setOver18(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>I confirm I am <strong>18 years or older</strong>.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  I accept the{" "}
                  <Link to="/legal/terms" className="text-primary underline-offset-2 hover:underline">
                    Terms
                  </Link>{" "}
                  &amp;{" "}
                  <Link to="/legal/privacy" className="text-primary underline-offset-2 hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            </div>
          )}

          <TurnstileWidget
            key={captchaNonce}
            onToken={(t) => { setCaptchaToken(t); if (authError?.resetCaptcha) setAuthError(null); }}
            onExpire={() => setCaptchaToken(null)}
          />

          {authError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <div className="flex items-start justify-between gap-2">
                <span>{authError.message}</span>
                {authError.code === "email_not_confirmed" && (
                  <Link
                    to="/auth/check-email"
                    search={{ email: email || undefined }}
                    className="shrink-0 text-xs font-medium underline"
                  >
                    Retrimite emailul
                  </Link>
                )}
              </div>
              {retryCountdown > 0 && (
                <p className="mt-1 text-xs opacity-80">Mai poți încerca în {retryCountdown}s.</p>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={
              submitting ||
              oauthBusy !== null ||
              signupDisabled ||
              (captchaRequired && !captchaToken) ||
              retryCountdown > 0
            }
            className="h-12 w-full rounded-full text-sm uppercase tracking-[0.18em]"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : retryCountdown > 0 ? (
              `Așteaptă ${retryCountdown}s`
            ) : mode === "signup" ? (
              "Create account"
            ) : (
              "Log in"
            )}
          </Button>

          {mode === "login" ? (
            <p className="text-center text-xs text-muted-foreground">
              No account yet?{" "}
              <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Already a member?{" "}
              <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                Log in
              </button>
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/legal/terms" className="hover:text-primary">Terms</Link> and{" "}
          <Link to="/legal/privacy" className="hover:text-primary">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
