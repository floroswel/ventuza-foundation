import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, Bug, Copy, Trash2 } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCountryGate } from "@/lib/country-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TurnstileWidget, isCaptchaMandatory, isTurnstileMisconfiguredInProd } from "@/components/TurnstileWidget";
import { Label } from "@/components/ui/label";
import { translateAuthError, type FriendlyAuthError } from "@/lib/auth-errors";
import { CANONICAL_ORIGIN, oauthOrigin } from "@/lib/canonical-origin";
import { classifySigningCertificate, describeInstallSource, readAndroidSignature, type AndroidSignatureInfo } from "@/lib/android-signature";
import { isNativePlatformSync } from "@/lib/native-platform-sync";

import { SUZETA_ICON_URL } from "@/lib/brand-assets";
import {
  MOBILE_BUILD_SHA,
  MOBILE_VERSION_CODE,
  NATIVE_REPAIR_MARKER,
  shortBuildSha,
} from "@/lib/build-info";
import { withGuardian } from "@/components/with-guardian";
import { withAuthTimeout } from "@/lib/auth-timeout";
import { inspectSupabaseConfig, maskEmail, readAuthStages, recordStage, supabaseHealthCheck } from "@/lib/auth-telemetry";
import { clearEntries, getEntries, installOnce, isDebugEnabled, log as debugLog, setDebugEnabled } from "@/lib/debug-logger";



const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).catch("login"),
  redirect: z.string().optional(),
  // Router-ul convertește `?native_bridge=1` în number — acceptăm ambele.
  native_bridge: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : String(v))),
  auto: z.string().optional(),

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

type AuthDiagnosticLine = {
  at: string;
  flow: "sistem" | "email" | "legacy";
  status: string;
  detail?: string;
};

/**
 * Log structurat pentru fluxurile de autentificare.
 * NU loghează niciodată parole sau tokenuri — doar prezență + lungime.
 */
function authLog(step: string, extra?: Record<string, unknown>) {
  try {
    if (extra && Object.keys(extra).length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[AUTH] ${step}`, extra);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[AUTH] ${step}`);
    }
  } catch {
    /* ignore */
  }
}

function tokenInfo(token: string | null | undefined) {
  return { present: !!token, length: token ? token.length : 0 };
}

/** Extrage câmpurile reale dintr-o eroare Supabase, fără să le înghită. */
function supabaseErrorInfo(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string; name?: string } | null;
  return {
    status: e?.status ?? null,
    code: e?.code ?? null,
    msg: e?.message ?? String(err),
    name: e?.name ?? null,
  };
}

function isSupabaseAuthError(err: unknown): err is { message: string; code?: string; status?: number } {
  const e = err as { name?: string; message?: string; status?: number; code?: string } | null;
  if (!e || typeof e.message !== "string") return false;
  if (e.name === "AuthTimeoutError") return false;
  return typeof e.status === "number" || typeof e.code === "string" || /Auth/.test(e.name ?? "");
}


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
    await withAuthTimeout(
      "pending_birthdate_update",
      supabase.from("profiles").update({ birthdate: pending }).eq("id", userId),
      8_000,
    );
  } catch {
    /* ignore — nu blocăm redirectul post-login */
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
    authLog("NAVIGATION_STARTED", { to: redirectTo, reason: "redirect_param" });
    navigate({ to: redirectTo, replace: true });
    authLog("AUTH_NAVIGATION_FINISHED", { to: redirectTo });
    return;
  }
  authLog("PROFILE_FETCH_STARTED", { userId: !!userId });
  let data: { onboarding_completed?: boolean | null; birthdate?: string | null } | null = null;
  try {
    const res = await withAuthTimeout(
      "profile_route",
      supabase
        .from("profiles")
        .select("onboarding_completed, birthdate")
        .eq("id", userId)
        .maybeSingle(),
      4_000,
    );
    data = res.data;
    authLog("PROFILE_FETCH_FINISHED", {
      err: res.error ? supabaseErrorInfo(res.error) : null,
      rowPresent: !!res.data,
      onboarding_completed: res.data?.onboarding_completed ?? null,
      birthdatePresent: !!res.data?.birthdate,
    });
  } catch (err) {
    authLog("PROFILE_FETCH_FINISHED", { err: supabaseErrorInfo(err) });
    throw err;
  }
  // OAuth signups may not have a birthdate yet — SessionGuards also enforces
  // this, but we route directly to /n to avoid a flash of /discover.
  if (!data?.birthdate) {
    authLog("NAVIGATION_STARTED", { to: "/n", reason: "missing_birthdate" });
    navigate({ to: "/n", replace: true });
    authLog("AUTH_NAVIGATION_FINISHED", { to: "/n" });
    return;
  }
  // Default landing for returning users is /discover (the main feed).
  // /cruise is the opt-in "Right Now" feed and used to be a confusing default.
  const target = data?.onboarding_completed ? "/discover" : "/n";
  authLog("NAVIGATION_STARTED", { to: target, reason: "onboarding_gate" });
  navigate({ to: target, replace: true });
  authLog("AUTH_NAVIGATION_FINISHED", { to: target });
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
  const [isNative, setIsNative] = useState(isNativePlatformSync());
  const [nativeChecked, setNativeChecked] = useState(false);
  const [diagnosticEnabled, setDiagnosticEnabled] = useState(false);
  const [signatureInfo, setSignatureInfo] = useState<AndroidSignatureInfo | null>(null);
  const [diagnosticLines, setDiagnosticLines] = useState<AuthDiagnosticLine[]>([]);
  /** Banner pentru linkuri/callback-uri vechi de Google OAuth. */
  const [legacyOauthNotice, setLegacyOauthNotice] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  function addDiagnostic(flow: AuthDiagnosticLine["flow"], status: string, detail?: string) {
    const line = { at: new Date().toISOString(), flow, status, detail };
    setDiagnosticLines((current) => [...current.slice(-29), line]);
    debugLog({ level: status.includes("ERROR") || status.includes("TIMEOUT") ? "error" : "event", source: `auth.${flow}`, message: status, details: detail });
  }

  useEffect(() => {
    let cancelled = false;
    const debugOn = isDebugEnabled();
    setDiagnosticEnabled(debugOn);
    if (debugOn) installOnce();
    void (async () => {
      const native = isNativePlatformSync();
      if (cancelled) return;
      setIsNative(native);
      setSignatureInfo(readAndroidSignature());
      setNativeChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const certificateMatch = classifySigningCertificate(signatureInfo?.sha1);



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

  // Linkuri/callback-uri vechi de Google OAuth: `?native_bridge=1&auto=google`
  // sau un hash `#...provider=google` / `#error=...`. Nu mai există niciun flux
  // OAuth — afișăm un mesaj clar și lăsăm userul pe email + parolă.
  useEffect(() => {
    let legacy = search.auto === "google" || search.native_bridge !== undefined;
    try {
      const hash = window.location.hash ?? "";
      if (/provider=google|providerToken|access_token|error_description/i.test(hash)) legacy = true;
      // curățăm resturile de OAuth din URL ca să nu rămână la refresh
      if (legacy && hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      sessionStorage.removeItem("vz_native_bridge");
    } catch { /* ignore */ }
    if (legacy) {
      setLegacyOauthNotice(true);
      addDiagnostic("legacy", "GOOGLE_OAUTH_LINK_BLOCKED", "Google OAuth eliminat — redirect către email + parolă");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.auto, search.native_bridge]);

  useEffect(() => {
    if (!authLoading && user) {
      void (async () => {
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
      handleAuthError(new Error("Verificarea anti-bot nu este configurată pentru acest domeniu. Contactează suportul (dpo@suzeta.ro)."));
      return;
    }
    if (captchaRequired && !captchaToken) {
      handleAuthError(new Error("captcha required"));
      return;
    }
    setAuthError(null);

    setSubmitting(true);
    // Watchdog absolut: indiferent ce await rămâne suspendat (SDK, storage
    // nativ, fetch fără răspuns), spinner-ul se eliberează și userul primește
    // o eroare reală în loc să aștepte la infinit.
    const watchdog = window.setTimeout(() => {
      authLog("AUTH_WATCHDOG_TRIPPED", { mode, afterMs: 45_000 });
      addDiagnostic("email", "WATCHDOG_TRIPPED", "45 s fără finalizare — deblochez butonul");
      setSubmitting(false);
      handleAuthError(new Error("auth_watchdog_timeout"), {
        message: "Cererea de autentificare nu a primit răspuns.",
        action: "Verifică conexiunea și apasă din nou — cererea a fost oprită.",
      });
    }, 45_000);
    authLog(mode === "signup" ? "EMAIL_SIGNUP_REQUESTED" : "EMAIL_LOGIN_STARTED", {
      mode,
      captchaRequired,
      captchaToken: tokenInfo(captchaToken),
    });
    addDiagnostic("email", "REQUEST_STARTED", `operație=${mode}`);
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

        // Preflight-uri (disposable email + anti-bot). Rulează în paralel, cu
        // timeout scurt și fail-open: pe rețele mobile lente nu au voie să
        // consume bugetul de timp al signup-ului propriu-zis.
        authLog("PREFLIGHT_ALL_STARTED", { timeoutMs: 1500, failOpen: true });
        addDiagnostic("email", "PREFLIGHT_ALL_STARTED", "assert_email_allowed + signup-guard (paralel, 1.5s, fail-open)");
        if (!captchaRequired) authLog("TURNSTILE_SKIPPED_ANDROID");
        else authLog(captchaToken ? "TURNSTILE_TOKEN_RECEIVED" : "TURNSTILE_FAILED", { captchaToken: tokenInfo(captchaToken) });
        addDiagnostic(
          "email",
          captchaRequired
            ? captchaToken
              ? "TURNSTILE_TOKEN_RECEIVED"
              : "TURNSTILE_FAILED"
            : "TURNSTILE_SKIPPED_ANDROID",
        );
        const nativeRuntime = isNativePlatformSync();
        const guardUrl = nativeRuntime
          ? "https://suzeta.app/api/public/signup-guard"
          : "/api/public/signup-guard";

        const PREFLIGHT_MS = 1_500;
        const settled = await Promise.allSettled([
          (async () => {
            authLog("EMAIL_ALLOWED_STARTED");
            addDiagnostic("email", "EMAIL_ALLOWED_STARTED");
            const t0 = Date.now();
            try {
              const r = await withAuthTimeout(
                "email_preflight",
                supabase.rpc("assert_email_allowed", { _email: emailParsed.data }),
                PREFLIGHT_MS,
              );
              authLog("EMAIL_ALLOWED_FINISHED", { ms: Date.now() - t0, err: r.error ? supabaseErrorInfo(r.error) : null });
              addDiagnostic("email", "EMAIL_ALLOWED_FINISHED", `${Date.now() - t0} ms`);
              return r;
            } catch (e) {
              authLog("EMAIL_ALLOWED_TIMEOUT", { ms: Date.now() - t0, err: supabaseErrorInfo(e) });
              addDiagnostic(
                "email",
                "EMAIL_ALLOWED_TIMEOUT",
                `${Date.now() - t0} ms · ${e instanceof Error ? e.message : String(e)}`,
              );
              // Fail-open: nu blocăm signup-ul dacă RPC-ul anti-spam nu răspunde.
              authLog("PRECHECK_TIMEOUT_FAIL_OPEN", { which: "assert_email_allowed" });
              addDiagnostic("email", "PRECHECK_TIMEOUT_FAIL_OPEN", "assert_email_allowed");
              return null;
            }
          })(),
          (async () => {
            authLog("SIGNUP_GUARD_STARTED", { url: guardUrl });
            addDiagnostic("email", "SIGNUP_GUARD_STARTED", guardUrl);
            const t0 = Date.now();
            try {
              const { computeDeviceFingerprint } = await import("@/lib/fingerprint");
              // Amprenta de device poate rămâne suspendată în WebView-ul nativ
              // (API-uri care nu răspund niciodată). Fără acest timeout, întregul
              // preflight nu se mai rezolvă și butonul se învârte la infinit.
              const fp = await Promise.race([
                computeDeviceFingerprint().catch(() => null),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 750)),
              ]);
              if (!fp) authLog("FINGERPRINT_SKIPPED", { reason: "timeout_or_error" });
              const res = await fetch(guardUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fingerprint: fp ?? undefined }),
                signal: AbortSignal.timeout(PREFLIGHT_MS),
              });
              authLog("SIGNUP_GUARD_FINISHED", { status: res.status, ms: Date.now() - t0 });
              addDiagnostic("email", "SIGNUP_GUARD_FINISHED", `HTTP ${res.status} · ${Date.now() - t0} ms`);
              return res;
            } catch (guardError) {
              authLog("SIGNUP_GUARD_TIMEOUT", { ms: Date.now() - t0, err: supabaseErrorInfo(guardError) });
              addDiagnostic(
                "email",
                "SIGNUP_GUARD_TIMEOUT",
                `${Date.now() - t0} ms · ${guardError instanceof Error ? guardError.message : String(guardError)}`,
              );
              authLog("PRECHECK_TIMEOUT_FAIL_OPEN", { which: "signup-guard" });
              addDiagnostic("email", "PRECHECK_TIMEOUT_FAIL_OPEN", "signup-guard");
              return null;
            }
          })(),
        ]);
        const preflight = settled[0].status === "fulfilled" ? settled[0].value : null;
        const guard = settled[1].status === "fulfilled" ? settled[1].value : null;

        // Doar un refuz EXPLICIT al serverului oprește signup-ul. Timeout,
        // rețea căzută sau eroare de transport → continuăm (fail-open).
        if (preflight?.error) {
          addDiagnostic("email", "PREFLIGHT_ERROR", preflight.error.message);
          handleAuthError(preflight.error);
          return;
        }
        if (guard && guard.status === 429) {
          const payload = (await guard.json().catch(() => ({}))) as {
            error?: string;
            retryAfterSec?: number;
          };
          const headerRetry = Number(guard.headers.get("Retry-After") ?? "");
          const retryAfterSec =
            payload.retryAfterSec ??
            (Number.isFinite(headerRetry) && headerRetry > 0 ? headerRetry : 3600);
          handleAuthError(new Error(payload.error ?? "signup_throttled"), { retryAfterSec });
          return;
        }
        if (!preflight || !guard) {
          authLog("PREFLIGHT_CONTINUE_FAIL_OPEN", { preflight: !!preflight, guard: !!guard });
          addDiagnostic("email", "PREFLIGHT_CONTINUE_FAIL_OPEN", "continui la Supabase signUp");
        }
        authLog("SUPABASE_SIGNUP_STARTED", { email: maskEmail(emailParsed.data), captchaToken: tokenInfo(captchaToken) });
        addDiagnostic("email", "SUPABASE_SIGNUP_STARTED", maskEmail(emailParsed.data));

        addDiagnostic("email", "AUTH_REQUEST_STARTED", `signUp · ${maskEmail(emailParsed.data)}`);
        const signupStartedAt = Date.now();
        const { data, error } = await withAuthTimeout(
          "email_signup",
          supabase.auth.signUp({
            email: emailParsed.data,
            password: passParsed.data,
            options: {
              emailRedirectTo: `${oauthOrigin()}/n`,
              captchaToken: captchaToken ?? undefined,
            },
          }),
          20_000,
        );
        recordStage("auth.signUp", Date.now() - signupStartedAt);
        {
          const info = supabaseErrorInfo(error);
          authLog(
            `SUPABASE_SIGNUP_RESPONSE status=${error ? info.status : 200} code=${error ? info.code : "none"} msg=${error ? info.msg : "ok"}`,
            { ms: Date.now() - signupStartedAt, error: error ?? null, userPresent: !!data?.user, sessionPresent: !!data?.session },
          );
        }

        if (error) {
          addDiagnostic("email", "AUTH_RESPONSE_ERROR", `cod=${error.code ?? "-"} · status=${error.status ?? "-"} · ${error.message}`);
          // Eroare reală de la Supabase → afișăm mesajul real, nu „verifică internetul”.
          handleAuthError(error, isSupabaseAuthError(error) ? { message: error.message } : undefined);
          return;
        }
        authLog("USER_CREATED", { userPresent: !!data.user, sessionPresent: !!data.session });
        addDiagnostic("email", "AUTH_RESPONSE_RECEIVED", `user=${data.user ? "da" : "nu"} · session=${data.session ? "da" : "nu"}`);
        // Persist birthdate on profile (trigger `enforce_min_age` enforces 18+ server-side).
        // ATENȚIE: fără sesiune (confirmare email obligatorie) update-ul rulează ca
        // anon și nu poate reuși — nu blocăm userul acolo, salvăm local și îl
        // trimitem imediat la ecranul „verifică emailul”. /n scrie birthdate după login.
        if (data.user && data.session) {
          const browserLang = (navigator.language || "ro").toLowerCase().startsWith("ro") ? "ro" : "en";
          authLog("PROFILE_CREATION_STARTED", { hasSession: true });
          try {
            const upd = await withAuthTimeout(
              "profile_signup_update",
              supabase
                .from("profiles")
                .update({ birthdate: birthDate, preferred_language: browserLang })
                .eq("id", data.user.id),
              3_000,
            );
            authLog("PROFILE_CREATION_FINISHED", { err: upd.error ? supabaseErrorInfo(upd.error) : null });
            addDiagnostic("email", "PROFILE_UPDATE_RESPONSE_RECEIVED");
          } catch (err) {
            authLog("PROFILE_CREATION_FINISHED", { err: supabaseErrorInfo(err) });
            addDiagnostic("email", "PROFILE_UPDATE_SKIPPED", "timeout · continuăm");
          }
        } else {
          authLog("PROFILE_CREATION_STARTED", { hasSession: false, skipped: true });
          authLog("PROFILE_CREATION_FINISHED", { err: null, skipped: "no_session" });
        }
        try {
          if (birthDate) {
            sessionStorage.setItem("vz_pending_birthdate", birthDate);
            localStorage.setItem("vz_pending_birthdate", birthDate);
          }
        } catch { /* ignore */ }
        if (data.session) {
          toast.success(t("auth.errors.welcome"));
          authLog("AUTH_NAVIGATION_STARTED", { reason: "session_present" });
          if (data.user) await routeAfterAuth(data.user.id, navigate);
        } else {
          // Confirmarea emailului este obligatorie înainte de onboarding și
          // funcțiile sociale. Fără sesiune, signup-ul a reușit și emailul de
          // activare a fost trimis — nu prezentăm acest caz drept eroare.
          authLog("EMAIL_CONFIRMATION_REQUIRED", { email: maskEmail(emailParsed.data) });
          addDiagnostic("email", "EMAIL_CONFIRMATION_REQUIRED", maskEmail(emailParsed.data));
          toast.success("Cont creat. Verifică emailul pentru activare.");
          navigate({
            to: "/auth/check-email",
            search: { email: emailParsed.data },
            replace: true,
          });
        }

      } else {
        authLog("SUPABASE_LOGIN_STARTED", { email: maskEmail(emailParsed.data), captchaToken: tokenInfo(captchaToken) });
        addDiagnostic("email", "EMAIL_LOGIN_STARTED", maskEmail(emailParsed.data));
        const loginStartedAt = Date.now();
        const { data, error } = await withAuthTimeout(
          "email_login",
          supabase.auth.signInWithPassword({
            email: emailParsed.data,
            password: passParsed.data,
            options: { captchaToken: captchaToken ?? undefined },
          }),
          20_000,
        );
        recordStage("auth.signInWithPassword", Date.now() - loginStartedAt);
        {
          const info = supabaseErrorInfo(error);
          authLog(
            `SUPABASE_LOGIN_RESPONSE status=${error ? info.status : 200} code=${error ? info.code : "none"} msg=${error ? info.msg : "ok"} sessionPresent=${!!data?.session}`,
            { ms: Date.now() - loginStartedAt, error: error ?? null, userPresent: !!data?.user },
          );
        }

        if (error) {
          addDiagnostic("email", "AUTH_RESPONSE_ERROR", `cod=${error.code ?? "-"} · status=${error.status ?? "-"} · ${error.message}`);
          handleAuthError(error, isSupabaseAuthError(error) ? { message: error.message } : undefined);
          return;
        }
        if (data.session) authLog("SESSION_CREATED", { userPresent: !!data.user });
        addDiagnostic("email", "AUTH_RESPONSE_RECEIVED", `user=${data.user ? "da" : "nu"} · session=${data.session ? "da" : "nu"}`);
        if (data.user) {
          await routeAfterAuth(data.user.id, navigate, search.redirect);
          authLog("LOGIN_FINISHED");
        } else {
          authLog("LOGIN_FINISHED", { warn: "no_user_in_response" });
        }
      }
    } catch (error) {
      authLog("AUTH_ERROR_FINAL", { raw: error, info: supabaseErrorInfo(error) });
      if (error instanceof Error && error.name === "AuthTimeoutError") {
        addDiagnostic("email", "TIMEOUT", error.message);
        // Recuperare: cererea poate să fi reușit pe server chiar dacă răspunsul
        // a întârziat (rețea mobilă lentă). Verificăm sesiunea reală înainte
        // să afișăm o eroare roșie.
        // getSession() poate rămâne blocat pe lock-ul intern al clientului
        // Supabase în WebView. Îl mărginim explicit ca să nu blocăm handlerul.
        const { data: recovered } = await withAuthTimeout(
          "session_recovery",
          supabase.auth.getSession(),
          5_000,
        ).catch(() => ({ data: { session: null } }));
        if (recovered?.session?.user) {
          authLog("SESSION_CREATED", { via: "timeout_recovery" });
          addDiagnostic("email", "TIMEOUT_RECOVERED", "sesiune activă găsită după timeout");
          await routeAfterAuth(recovered.session.user.id, navigate, search.redirect);
          return;
        }
        // Diferențiem OFFLINE (telefonul nu are net) de TIMEOUT server.
        const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
        if (!online) {
          addDiagnostic("email", "AUTH_OFFLINE", "navigator.onLine=false");
          handleAuthError(error, {
            message: "Telefonul nu este conectat la internet.",
            action: "Activează datele mobile sau Wi-Fi, apoi apasă din nou.",
          });
          return;
        }
        const health = await supabaseHealthCheck(5_000);
        authLog("HEALTH_CHECK", { status: health.status, httpStatus: health.httpStatus ?? null, ms: health.durationMs });
        addDiagnostic(
          "email",
          `HEALTH_${health.status.toUpperCase()}`,
          `${health.host} · HTTP ${health.httpStatus ?? "-"} · ${health.durationMs} ms`,
        );
        handleAuthError(error, {
          message:
            health.status === "connected"
              ? "Răspunsul autentificării a întârziat pe acest dispozitiv."
              : "AUTH_NETWORK_TIMEOUT: nu am putut ajunge la serverul de autentificare.",
          action:
            health.status === "connected"
              ? "Serverul este activ. Apasă din nou; aplicația nu va mai rămâne blocată la salvarea sesiunii."
              : "Verifică datele mobile sau Wi-Fi și încearcă din nou.",
        });
      } else {
        addDiagnostic("email", "ERROR", error instanceof Error ? error.message : String(error));
        // Eroare reală Supabase (nu timeout) → afișăm mesajul real al serverului.
        handleAuthError(error, isSupabaseAuthError(error) ? { message: error.message } : undefined);
      }

    } finally {
      window.clearTimeout(watchdog);
      setSubmitting(false);
      addDiagnostic("email", "REQUEST_FINISHED");
      authLog(mode === "signup" ? "EMAIL_SIGNUP_FINISHED" : "EMAIL_LOGIN_HANDLER_FINISHED", { submitting: false });
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
      handleAuthError(new Error("Verificarea anti-bot nu este configurată. Contactează suportul (dpo@suzeta.ro)."));
      return;
    }
    if (captchaRequired && !captchaToken) {
      handleAuthError(new Error("captcha required"));
      return;
    }
    setAuthError(null);
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailParsed.data, {
        // Recuperarea parolei este un flux sensibil, cross-device. Nu folosim
        // originea preview-ului/editorului: tokenul trebuie consumat direct pe
        // domeniul public Suzeta, fără să expună infrastructura de dezvoltare.
        redirectTo: `${CANONICAL_ORIGIN}/reset-password`,
        captchaToken: captchaToken ?? undefined,
      });
      if (error) {
        handleAuthError(error);
        return;
      }
      setResetSentTo(maskEmail(emailParsed.data));
      toast.success(t("auth.errors.resetSent"));
    } finally {
      setResetBusy(false);
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
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

        {legacyOauthNotice && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600"
          >
            <p className="font-semibold">Autentificarea cu Google nu mai este disponibilă</p>
            <p className="mt-1 text-xs">
              Ai deschis un link vechi de conectare cu Google. Contul Suzeta funcționează acum
              exclusiv cu email și parolă. Dacă ți-ai creat contul cu Google, folosește aceeași
              adresă de email și apasă „Ai uitat parola?” pentru a-ți seta o parolă.
            </p>
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
              <div className="space-y-1 pt-1">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={resetBusy}
                  className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary underline underline-offset-4 disabled:opacity-60"
                >
                  {resetBusy ? "Se trimite…" : t("auth.forgot")}
                </button>
                {resetSentTo && (
                  <p className="text-[11px] text-muted-foreground">
                    Ți-am trimis un link de resetare a parolei la {resetSentTo}. Verifică și folderul
                    Spam; linkul expiră în scurt timp.
                  </p>
                )}
              </div>
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

        {isNative && (
          <p
            className="mt-2 text-center text-[10px] text-muted-foreground"
            data-native-repair={NATIVE_REPAIR_MARKER}
            title={MOBILE_BUILD_SHA}
          >
            Android build {MOBILE_VERSION_CODE} · {shortBuildSha}
          </p>
        )}

      </div>
    </main>
  );
}
