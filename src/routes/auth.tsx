import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCountryGate } from "@/lib/country-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TurnstileWidget, isCaptchaMandatory, isTurnstileMisconfiguredInProd } from "@/components/TurnstileWidget";
import { Label } from "@/components/ui/label";
import { translateAuthError, type FriendlyAuthError } from "@/lib/auth-errors";
import { lovable } from "@/integrations/lovable";
import { oauthOrigin } from "@/lib/canonical-origin";
import {
  nativeGoogleSignIn,
  isNativeAndroid,
  hasNativeGoogleConfig,
  hasNativeGoogleConfigAsync,
} from "@/lib/native-google-auth";

import { SUZETA_ICON_URL } from "@/lib/brand-assets";
import { withGuardian } from "@/components/with-guardian";



const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).catch("login"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Suzeta" },
      { name: "description", content: "Sign in or create your Suzeta account." },
    ],
  }),
  component: withGuardian("auth", AuthPage, "auth"),
});

const emailSchema = z.string().trim().email("invalid_email").max(255);
const passwordSchema = z.string().min(8, "password_min").max(72, "password_max");

async function persistPendingBirthdate(userId: string) {
  if (typeof window === "undefined") return;
  // sessionStorage poate fi pierdut între contexte (Safari ASWebAuthSession,
  // browser extern pe mobil). Citim din ambele și ștergem după.
  let pending: string | null = null;
  try {
    pending = sessionStorage.getItem("vz_pending_birthdate");
  } catch {
    /* ignore */
  }
  if (!pending) {
    try {
      pending = localStorage.getItem("vz_pending_birthdate");
    } catch {
      /* ignore */
    }
  }
  if (!pending) return;
  try {
    await supabase.from("profiles").update({ birthdate: pending }).eq("id", userId);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem("vz_pending_birthdate");
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem("vz_pending_birthdate");
  } catch {
    /* ignore */
  }
}

async function routeAfterAuth(
  userId: string,
  navigate: ReturnType<typeof useNavigate>,
  redirectTo?: string,
) {
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
  const { t } = useTranslation();
  const search = Route.useSearch();

  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const countryGate = useCountryGate();
  const [mode, setMode] = useState<"login" | "signup">(search.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [over18, setOver18] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [authError, setAuthError] = useState<FriendlyAuthError | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const captchaRequired = isCaptchaMandatory();
  const captchaMisconfigured = isTurnstileMisconfiguredInProd();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [nativeChecked, setNativeChecked] = useState(false);
  const [nativeGoogleReady, setNativeGoogleReady] = useState(hasNativeGoogleConfig());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const native = await isNativeAndroid();
      if (cancelled) return;
      setIsNative(native);
      // Sondăm Client ID-ul DOAR pe nativ. Pe web nu e nevoie (folosim brokerul
      // managed) și fetch-ul suplimentar întârzia inutil randarea formularului.
      if (native) {
        const ready = await hasNativeGoogleConfigAsync();
        if (!cancelled) setNativeGoogleReady(ready);
      }
      if (!cancelled) setNativeChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // Butonul Google apare doar dacă avem cale funcțională:
  //  - pe Android nativ: doar dacă avem Web Client ID (env sau secret server)
  //  - pe web: mereu (broker Lovable managed OAuth)
  const googleAvailable = isNative ? nativeGoogleReady : nativeChecked || !isNative;



  async function onGoogleSignIn() {
    if (googleBusy) return;
    if (countryGate.isBlocked) {
      navigate({ to: "/blocked-region", replace: true });
      return;
    }
    if (mode === "signup" && birthDate) {
      // Persist pentru completare profil post-OAuth (SessionGuards → /n).
      try {
        sessionStorage.setItem("vz_pending_birthdate", birthDate);
        localStorage.setItem("vz_pending_birthdate", birthDate);
      } catch { /* ignore */ }
    }
    setAuthError(null);
    setGoogleBusy(true);
    try {
      // În Capacitor (WebView) fluxul web de OAuth prin redirect dă 404 —
      // Google blochează sign-in-ul din WebView-uri. Pe nativ mergem EXCLUSIV
      // pe SDK-ul nativ + supabase.auth.signInWithIdToken; nu facem niciodată
      // fallback pe redirect web.
      if (await isNativePlatform()) {
        const res = await nativeGoogleSignIn();
        if (!res.ok) {
          if (res.code === "cancelled") return;
          handleAuthError(new Error(res.message ?? "Google sign-in failed"));
          return;
        }
        // Session set by supabase.auth.signInWithIdToken; SessionGuards redirects.
      } else {
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: `${oauthOrigin()}/auth`,
        });
        if (result?.error) {
          handleAuthError(result.error);
          return;
        }
        // if redirected, browser leaves this page
      }

    } finally {
      setGoogleBusy(false);
    }
  }



  useEffect(() => {
    if (retryCountdown <= 0) return;
    const t = setTimeout(() => setRetryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [retryCountdown]);

  function handleAuthError(err: unknown, override?: Partial<FriendlyAuthError>) {
    const mapped = { ...translateAuthError(t, err), ...(override ?? {}) };
    setAuthError(mapped);
    if (mapped.retryAfterSec) setRetryCountdown(mapped.retryAfterSec);
    if (mapped.resetCaptcha) {
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
    }
    toast.error(mapped.message, { description: mapped.action, duration: mapped.retryAfterSec && mapped.retryAfterSec > 30 ? 8000 : 5500 });
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

  const signupDisabled =
    mode === "signup" && (!over18 || !acceptTerms || (ageFromBirthDate(birthDate) ?? 0) < 18);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (countryGate.isBlocked) {
      navigate({ to: "/blocked-region", replace: true });
      return;
    }

    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      const key = emailParsed.error.issues[0]?.message === "invalid_email"
        ? "auth.errors.invalidEmail"
        : "auth.errors.invalidEmail";
      toast.error(t(key));
      return;
    }
    const passParsed = passwordSchema.safeParse(password);
    if (!passParsed.success) {
      const code = passParsed.error.issues[0]?.message;
      const key = code === "password_max" ? "auth.errors.passwordMax" : "auth.errors.passwordMin";
      toast.error(t(key));
      return;
    }

    if (captchaMisconfigured) {
      handleAuthError(new Error("Verificarea anti-bot nu este configurată pentru acest domeniu. Contactează suportul (dpo@suzeta.eu)."));
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
          toast.error(t("auth.errors.confirmChecks"));
          return;
        }
        const age = ageFromBirthDate(birthDate);
        if (age === null) {
          toast.error(t("auth.errors.needBirthdate"));
          return;
        }
        if (age < 18) {
          toast.error(t("auth.errors.tooYoung"));
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
        // Anti-bot throttle per IP + device fingerprint (caps at /api/public/signup-guard).
        try {
          const { computeDeviceFingerprint } = await import("@/lib/fingerprint");
          const fp = await computeDeviceFingerprint().catch(() => null);
          const guardRes = await fetch("/api/public/signup-guard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fingerprint: fp ?? undefined }),
          });
          if (guardRes.status === 429) {
            const payload = (await guardRes.json().catch(() => ({}))) as {
              error?: string;
              retryAfterSec?: number;
            };
            const headerRetry = Number(guardRes.headers.get("Retry-After") ?? "");
            const retryAfterSec =
              payload.retryAfterSec ??
              (Number.isFinite(headerRetry) && headerRetry > 0 ? headerRetry : 3600);
            handleAuthError(new Error(payload.error ?? "signup_throttled"), { retryAfterSec });
            return;
          }
        } catch {
          // Network failure: fail-open so real users aren't locked out.
        }
        const { data, error } = await supabase.auth.signUp({
          email: emailParsed.data,
          password: passParsed.data,
          options: {
            emailRedirectTo: `${oauthOrigin()}/n`,
            captchaToken: captchaToken ?? undefined,
          },
        });
        if (error) {
          handleAuthError(error);
          return;
        }
        // Persist birthdate on profile (trigger `enforce_min_age` enforces 18+ server-side).
        // Canonical column is `birthdate` — used by age gate, discover, /n onboarding.
        // Capture browser language as fallback for transactional emails (ro/en only).
        if (data.user) {
          const browserLang = (navigator.language || "ro").toLowerCase().startsWith("ro") ? "ro" : "en";
          await supabase
            .from("profiles")
            .update({ birthdate: birthDate, preferred_language: browserLang })
            .eq("id", data.user.id);
        }
        if (data.session) {
          toast.success(t("auth.errors.welcome"));
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

  // OAuth dezactivat — folosim doar email + parolă.




  async function onForgotPassword() {
    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      toast.error(t("auth.errors.enterEmailFirst"));
      return;
    }
    if (captchaMisconfigured) {
      handleAuthError(new Error("Verificarea anti-bot nu este configurată. Contactează suportul (dpo@suzeta.eu)."));
      return;
    }
    if (captchaRequired && !captchaToken) {
      handleAuthError(new Error("captcha required"));
      return;
    }
    setAuthError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(emailParsed.data, {
      redirectTo: `${oauthOrigin()}/reset-password`,
      captchaToken: captchaToken ?? undefined,
    });
    if (error) {
      handleAuthError(error);
    } else {
      toast.success(t("auth.errors.resetSent"));
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
        <Link
          to="/"
          className="self-start text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-primary"
        >
          {t("auth.back")}
        </Link>

        <div className="mt-10 flex flex-col items-center text-center">
          <img
            src={SUZETA_ICON_URL}
            alt=""
            width={72}
            height={72}
            className="mb-4 size-[72px] rounded-2xl shadow-lg shadow-primary/20"
          />
          <h1 className="wordmark text-5xl font-medium leading-none">Suzeta</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "signup" ? t("auth.createAccount") : t("auth.welcomeBack")}
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
              {m === "login" ? t("auth.tabLogin") : t("auth.tabSignup")}
            </button>

          ))}
        </div>

        {googleAvailable && (
          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2"
              onClick={onGoogleSignIn}
              disabled={googleBusy || submitting}
            >
              {googleBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.3-5.2l-6.1-5.2C29.2 35.5 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.7 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.1 5.2C40.2 36.6 44 30.9 44 24c0-1.2-.1-2.4-.4-3.5z" />
                </svg>
              )}
              <span>{t("auth.continueWithGoogle", { defaultValue: "Continue with Google" })}</span>
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {t("auth.or", { defaultValue: "or" })}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}


        {/* Email form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              {t("auth.email")}
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
                placeholder={t("auth.emailPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              {t("auth.password")}
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
                placeholder={
                  mode === "signup"
                    ? t("auth.passwordPlaceholderSignup")
                    : t("auth.passwordPlaceholderLogin")
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
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
                {t("auth.forgot")}
              </button>
            )}
          </div>

          {mode === "signup" && (
            <div className="space-y-3 rounded-xl border border-border bg-surface/60 p-4">
              <div>
                <Label
                  htmlFor="birthdate"
                  className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {t("auth.birthdate")}
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
                  <p className="mt-1 text-xs text-destructive">{t("auth.minAge")}</p>
                )}
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={over18}
                  onChange={(e) => setOver18(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <Trans i18nKey="auth.over18" components={{ 1: <strong /> }} />
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <Trans
                    i18nKey="auth.acceptTerms"
                    components={{
                      1: (
                        <Link
                          to="/legal/terms"
                          className="text-primary underline-offset-2 hover:underline"
                        />
                      ),
                      3: (
                        <Link
                          to="/legal/privacy"
                          className="text-primary underline-offset-2 hover:underline"
                        />
                      ),
                    }}
                  />
                </span>
              </label>
            </div>
          )}



          <TurnstileWidget
            key={captchaNonce}
            onToken={(tok) => {
              setCaptchaToken(tok);
              if (authError?.resetCaptcha) setAuthError(null);
            }}
            onExpire={() => setCaptchaToken(null)}
          />
          {captchaRequired && (
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              {captchaToken
                ? "✓ Verificare anti-bot completă"
                : "Așteaptă verificarea anti-bot…"}
            </p>
          )}

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
                    {t("auth.resend")}
                  </Link>
                )}
              </div>
              {retryCountdown > 0 && (
                <p className="mt-1 text-xs opacity-80">
                  {t("auth.retryCountdown", { s: retryCountdown })}
                </p>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={
              submitting ||
              signupDisabled ||
              (captchaRequired && !captchaToken) ||
              retryCountdown > 0
            }
            title={
              mode === "signup" && signupDisabled
                ? "Bifează 18+ și acceptarea termenilor, apoi introdu data nașterii."
                : captchaRequired && !captchaToken
                  ? "Așteaptă finalizarea verificării anti-bot."
                  : undefined
            }
            className="h-12 w-full rounded-full text-sm uppercase tracking-[0.18em]"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : retryCountdown > 0 ? (
              t("auth.retryIn", { s: retryCountdown })
            ) : mode === "signup" ? (
              t("auth.submitSignup")
            ) : (
              t("auth.submitLogin")
            )}
          </Button>
          {mode === "signup" && signupDisabled && (
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              Bifează „am 18+" și „accept termenii", apoi introdu data nașterii pentru a activa butonul.
            </p>
          )}

          {mode === "login" ? (
            <p className="text-center text-xs text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-primary hover:underline"
              >
                {t("auth.switchSignup")}
              </button>
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {t("auth.haveAccount")}{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-primary hover:underline"
              >
                {t("auth.switchLogin")}
              </button>
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
          <Trans
            i18nKey="auth.footer"
            components={{
              1: <Link to="/legal/terms" className="hover:text-primary" />,
              3: <Link to="/legal/privacy" className="hover:text-primary" />,
            }}
          />
        </p>

      </div>
    </main>
  );
}
