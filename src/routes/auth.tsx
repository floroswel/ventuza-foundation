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
import { lovable } from "@/integrations/lovable";
import { oauthOrigin } from "@/lib/canonical-origin";
import {
  nativeGoogleSignIn,
  isNativeAndroid,
  isNativePlatform,
  hasNativeGoogleConfig,
  hasNativeGoogleConfigAsync,
  resolveWebClientId,
  getNativeGoogleRuntimeState,
  type NativeGoogleRuntimeState,
  type NativeGoogleDiagnostic,
} from "@/lib/native-google-auth";
import { classifySigningCertificate, describeInstallSource, readAndroidSignature, readNativeGoogleLogs, readNativeLogcat, type AndroidSignatureInfo, type NativeGoogleLog } from "@/lib/android-signature";
import { browserGoogleSignIn, NATIVE_BRIDGE_CALLBACK } from "@/lib/native-oauth-browser";

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
  native_bridge: z.string().optional(),
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
  flow: "sistem" | "google" | "email";
  status: string;
  detail?: string;
};

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
  const { data } = await withAuthTimeout(
    "profile_route",
    supabase
      .from("profiles")
      .select("onboarding_completed, birthdate")
      .eq("id", userId)
      .maybeSingle(),
    10_000,
  );
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
  const [diagnosticEnabled, setDiagnosticEnabled] = useState(false);
  const [runtimeClientId, setRuntimeClientId] = useState<string | null>(null);
  const [signatureInfo, setSignatureInfo] = useState<AndroidSignatureInfo | null>(null);
  const [nativeGoogleLogs, setNativeGoogleLogs] = useState<NativeGoogleLog[]>([]);
  const [nativeLogcat, setNativeLogcat] = useState<string[]>([]);
  const [googleRuntime, setGoogleRuntime] = useState<NativeGoogleRuntimeState | null>(null);
  const [diagnosticLines, setDiagnosticLines] = useState<AuthDiagnosticLine[]>([]);
  const googleRequestActive = useRef(false);

  function addDiagnostic(flow: AuthDiagnosticLine["flow"], status: string, detail?: string) {
    const line = { at: new Date().toISOString(), flow, status, detail };
    setDiagnosticLines((current) => [...current.slice(-29), line]);
    debugLog({ level: status.includes("ERROR") || status.includes("TIMEOUT") ? "error" : "event", source: `auth.${flow}`, message: status, details: detail });
  }

  function formatGoogleDiagnostic(diagnostic?: NativeGoogleDiagnostic): string {
    if (!diagnostic) return "SDK-ul nu a furnizat detalii suplimentare.";
    return [
      `pas=${diagnostic.stage}`,
      `cod=${diagnostic.code ?? "necomunicat"}`,
      `HTTP=${diagnostic.httpStatus ?? "necomunicat"}`,
      `URL=${diagnostic.url ?? "necomunicat de Google SDK"}`,
      `durată=${diagnostic.elapsedMs !== undefined ? `${diagnostic.elapsedMs} ms` : "necronometrat"}`,
      diagnostic.message ? `mesaj=${diagnostic.message}` : null,
    ].filter(Boolean).join(" · ");
  }

  useEffect(() => {
    let cancelled = false;
    const debugOn = isDebugEnabled();
    setDiagnosticEnabled(debugOn);
    if (debugOn) installOnce();
    void (async () => {
      const native = await isNativeAndroid();
      if (cancelled) return;
      setIsNative(native);
      setSignatureInfo(readAndroidSignature());
      // Sondăm Client ID-ul DOAR pe nativ. Pe web nu e nevoie (folosim brokerul
      // managed) și fetch-ul suplimentar întârzia inutil randarea formularului.
      if (native) {
        const [ready, clientId] = await Promise.all([
          hasNativeGoogleConfigAsync(),
          resolveWebClientId(),
        ]);
        if (!cancelled) setRuntimeClientId(clientId);
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
  // Pe nativ butonul rămâne mereu disponibil: chiar fără Web Client ID avem
  // fallback-ul prin Chrome Custom Tabs (nu depinde de clientul Android).
  const googleAvailable = isNative ? true : nativeChecked || !isNative;
  const certificateMatch = classifySigningCertificate(signatureInfo?.sha1);



  async function onGoogleSignIn() {
    if (googleRequestActive.current) return;
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
    googleRequestActive.current = true;
    setAuthError(null);
    setGoogleBusy(true);
    addDiagnostic("google", "REQUEST_STARTED", `platform=${isNative ? "android-native" : "web"}`);
    try {
      // ANDROID: Chrome Custom Tabs mai întâi. Nu depinde de clientul OAuth
      // Android (package + SHA-1), deci funcționează inclusiv când amprenta
      // build-ului din Play nu e trecută în Google Cloud. SDK-ul nativ
      // (Credential Manager) rămâne fallback.
      if (await isNativePlatform()) {
        const pressedAt = Date.now();
        addDiagnostic("google", "CUSTOM_TAB_STARTED", `mode=${mode}`);
        const viaBrowser = await browserGoogleSignIn(180_000, mode === "signup" ? "signup" : "login");
        addDiagnostic("google", "CUSTOM_TAB_RETURNED", `durată=${Date.now() - pressedAt} ms`);
        if (viaBrowser.ok) {
          addDiagnostic("google", "DEEP_LINK_RECEIVED");
          addDiagnostic("google", "SUPABASE_SESSION_CREATED");
          return;
        }
        addDiagnostic("google", "CUSTOM_TAB_FAILED", viaBrowser.message ?? viaBrowser.code);

        // Fallback: SDK nativ (Credential Manager).
        addDiagnostic("google", "CREDENTIAL_REQUEST_STARTED", `clientId=${runtimeClientId ? "prezent" : "în curs"}`);
        const res = await nativeGoogleSignIn();
        setNativeGoogleLogs(readNativeGoogleLogs());
        setNativeLogcat(readNativeLogcat());
        setGoogleRuntime(getNativeGoogleRuntimeState());
        addDiagnostic("google", "CREDENTIAL_RETURNED", `durată=${Date.now() - pressedAt} ms`);
        if (res.ok) {
          addDiagnostic("google", "ID_TOKEN_RECEIVED", formatGoogleDiagnostic(res.diagnostic));
          addDiagnostic("google", "SUPABASE_SESSION_CREATED");
          return;
        }
        const label = {
          cancelled: "GOOGLE_USER_CANCELLED",
          no_credential: "GOOGLE_NO_CREDENTIAL_AVAILABLE",
          reauth_failed: "GOOGLE_ACCOUNT_REAUTH_FAILED",
          no_id_token: "GOOGLE_NO_ID_TOKEN",
          unsupported: "GOOGLE_SDK_UNSUPPORTED",
          error: "GOOGLE_SDK_ERROR",
        }[res.code];
        addDiagnostic("google", label, formatGoogleDiagnostic(res.diagnostic));
        if (viaBrowser.code === "cancelled" || res.code === "cancelled") {
          handleAuthError(new Error("Autentificarea Google a fost anulată."), {
            message: "Autentificarea Google a fost anulată.",
            action: "Apasă din nou și alege contul Google.",
          });
          return;
        }
        handleAuthError(new Error(res.message ?? viaBrowser.message ?? "Google sign-in failed"), {
          message:
            res.code === "reauth_failed"
              ? "Contul Google de pe telefon cere reautentificare (Setări → Conturi → Google)."
              : "Nu am putut finaliza autentificarea cu Google.",
          action: "Încearcă din nou sau folosește email și parolă.",
        });
        return;

      } else {



        addDiagnostic("google", "OAUTH_BROKER_STARTED", `redirect=${oauthOrigin()}/auth`);
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: `${oauthOrigin()}/auth`,
        });
        if (result?.error) {
          addDiagnostic("google", "ERROR", result.error.message);
          handleAuthError(result.error);
          return;
        }
        addDiagnostic("google", result.redirected ? "REDIRECT_STARTED" : "RESPONSE_RECEIVED");
        // if redirected, browser leaves this page
      }

    } finally {
      googleRequestActive.current = false;
      setGoogleBusy(false);
      addDiagnostic("google", "REQUEST_FINISHED");
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

  // Pagina web servește și ca „punte” pentru aplicația Android: când e
  // deschisă în Chrome Custom Tabs cu ?native_bridge=1, după autentificare
  // trimite sesiunea înapoi în app prin deep link în loc să navigheze intern.
  useEffect(() => {
    if (search.native_bridge === "1") {
      try { sessionStorage.setItem("vz_native_bridge", "1"); } catch { /* ignore */ }
    }
  }, [search.native_bridge]);

  // Auto-pornire OAuth când puntea e deschisă din aplicație: userul a apăsat
  // deja „Continuă cu Google” în app, nu trebuie să mai apese încă o dată.
  const bridgeAutoStarted = useRef(false);
  useEffect(() => {
    if (bridgeAutoStarted.current) return;
    if (authLoading || user) return;
    if (search.native_bridge !== "1" || search.auto !== "google") return;
    bridgeAutoStarted.current = true;
    void onGoogleSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, search.native_bridge, search.auto]);



  useEffect(() => {
    if (!authLoading && user) {
      void (async () => {
        // Catch OAuth round-trips that landed back on /auth.
        await persistPendingBirthdate(user.id);
        let bridge = search.native_bridge === "1";
        try { bridge = bridge || sessionStorage.getItem("vz_native_bridge") === "1"; } catch { /* ignore */ }
        if (bridge) {
          try { sessionStorage.removeItem("vz_native_bridge"); } catch { /* ignore */ }
          const { data } = await supabase.auth.getSession();
          const session = data.session;
          if (session?.access_token && session?.refresh_token) {
            const params = new URLSearchParams({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
            window.location.href = `${NATIVE_BRIDGE_CALLBACK}#${params.toString()}`;
            return;
          }
        }
        await routeAfterAuth(user.id, navigate, search.redirect);
      })();
    }
  }, [authLoading, user, navigate, search.redirect, search.native_bridge]);

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
        addDiagnostic("email", "PREFLIGHT_ALL_STARTED", "assert_email_allowed + signup-guard (paralel, 4s, fail-open)");
        addDiagnostic(
          "email",
          captchaRequired
            ? captchaToken
              ? "TURNSTILE_TOKEN_RECEIVED"
              : "TURNSTILE_FAILED"
            : "TURNSTILE_SKIPPED_ANDROID",
        );
        const nativeRuntime = await isNativePlatform();
        const guardUrl = nativeRuntime
          ? "https://suzeta.app/api/public/signup-guard"
          : "/api/public/signup-guard";

        const PREFLIGHT_MS = 4_000;
        const [preflight, guard] = await Promise.all([
          (async () => {
            addDiagnostic("email", "EMAIL_ALLOWED_STARTED");
            const t0 = Date.now();
            try {
              const r = await withAuthTimeout(
                "email_preflight",
                supabase.rpc("assert_email_allowed", { _email: emailParsed.data }),
                PREFLIGHT_MS,
              );
              addDiagnostic("email", "EMAIL_ALLOWED_FINISHED", `${Date.now() - t0} ms`);
              return r;
            } catch (e) {
              addDiagnostic(
                "email",
                "EMAIL_ALLOWED_TIMEOUT",
                `${Date.now() - t0} ms · ${e instanceof Error ? e.message : String(e)}`,
              );
              // Fail-open: nu blocăm signup-ul dacă RPC-ul anti-spam nu răspunde.
              addDiagnostic("email", "PRECHECK_TIMEOUT_FAIL_OPEN", "assert_email_allowed");
              return null;
            }
          })(),
          (async () => {
            addDiagnostic("email", "SIGNUP_GUARD_STARTED", guardUrl);
            const t0 = Date.now();
            try {
              const { computeDeviceFingerprint } = await import("@/lib/fingerprint");
              const fp = await computeDeviceFingerprint().catch(() => null);
              const res = await fetch(guardUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fingerprint: fp ?? undefined }),
                signal: AbortSignal.timeout(PREFLIGHT_MS),
              });
              addDiagnostic("email", "SIGNUP_GUARD_FINISHED", `HTTP ${res.status} · ${Date.now() - t0} ms`);
              return res;
            } catch (guardError) {
              addDiagnostic(
                "email",
                "SIGNUP_GUARD_TIMEOUT",
                `${Date.now() - t0} ms · ${guardError instanceof Error ? guardError.message : String(guardError)}`,
              );
              addDiagnostic("email", "PRECHECK_TIMEOUT_FAIL_OPEN", "signup-guard");
              return null;
            }
          })(),
        ]);

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
          addDiagnostic("email", "PREFLIGHT_CONTINUE_FAIL_OPEN", "continui la Supabase signUp");
        }
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


        if (error) {
          addDiagnostic("email", "AUTH_RESPONSE_ERROR", `cod=${error.code ?? "-"} · status=${error.status ?? "-"} · ${error.message}`);
          handleAuthError(error);
          return;
        }
        addDiagnostic("email", "AUTH_RESPONSE_RECEIVED", `user=${data.user ? "da" : "nu"} · session=${data.session ? "da" : "nu"}`);
        // Persist birthdate on profile (trigger `enforce_min_age` enforces 18+ server-side).
        // ATENȚIE: fără sesiune (confirmare email obligatorie) update-ul rulează ca
        // anon și nu poate reuși — nu blocăm userul acolo, salvăm local și îl
        // trimitem imediat la ecranul „verifică emailul”. /n scrie birthdate după login.
        if (data.user && data.session) {
          const browserLang = (navigator.language || "ro").toLowerCase().startsWith("ro") ? "ro" : "en";
          try {
            await withAuthTimeout(
              "profile_signup_update",
              supabase
                .from("profiles")
                .update({ birthdate: birthDate, preferred_language: browserLang })
                .eq("id", data.user.id),
              8_000,
            );
            addDiagnostic("email", "PROFILE_UPDATE_RESPONSE_RECEIVED");
          } catch {
            addDiagnostic("email", "PROFILE_UPDATE_SKIPPED", "timeout · continuăm");
          }
        }
        try {
          if (birthDate) {
            sessionStorage.setItem("vz_pending_birthdate", birthDate);
            localStorage.setItem("vz_pending_birthdate", birthDate);
          }
        } catch { /* ignore */ }
        if (data.session) {
          toast.success(t("auth.errors.welcome"));
          await routeAfterAuth(data.user!.id, navigate);
        } else {
          // Email confirmation required → ghidăm userul către o pagină dedicată
          // cu resend + countdown (nu îl lăsăm blocat pe /auth fără feedback).
          addDiagnostic("email", "SIGNUP_OK_EMAIL_CONFIRM_REQUIRED");
          navigate({ to: "/auth/check-email", search: { email: emailParsed.data }, replace: true });
        }

      } else {
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

        if (error) {
          addDiagnostic("email", "AUTH_RESPONSE_ERROR", `cod=${error.code ?? "-"} · status=${error.status ?? "-"} · ${error.message}`);
          handleAuthError(error);
          return;
        }
        addDiagnostic("email", "AUTH_RESPONSE_RECEIVED", `user=${data.user ? "da" : "nu"} · session=${data.session ? "da" : "nu"}`);
        if (data.user) await routeAfterAuth(data.user.id, navigate, search.redirect);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AuthTimeoutError") {
        addDiagnostic("email", "TIMEOUT", error.message);
        // Recuperare: cererea poate să fi reușit pe server chiar dacă răspunsul
        // a întârziat (rețea mobilă lentă). Verificăm sesiunea reală înainte
        // să afișăm o eroare roșie.
        const { data: recovered } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        if (recovered?.session?.user) {
          addDiagnostic("email", "TIMEOUT_RECOVERED", "sesiune activă găsită după timeout");
          await routeAfterAuth(recovered.session.user.id, navigate, search.redirect);
          return;
        }
        if (mode === "signup" && error.message.startsWith("email_signup")) {
          addDiagnostic("email", "TIMEOUT_SIGNUP_PENDING", "trimit userul la confirmarea emailului");
          toast.message("Cererea durează mai mult decât de obicei", {
            description: "Dacă ai primit emailul de confirmare, contul este creat. Verifică inboxul.",
          });
          navigate({ to: "/auth/check-email", search: { email }, replace: true });
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
        addDiagnostic(
          "email",
          `HEALTH_${health.status.toUpperCase()}`,
          `${health.host} · HTTP ${health.httpStatus ?? "-"} · ${health.durationMs} ms`,
        );
        handleAuthError(error, {
          message:
            health.status === "connected"
              ? "AUTH_SERVER_ERROR: serverul de autentificare nu a răspuns la timp."
              : "AUTH_NETWORK_TIMEOUT: nu am putut ajunge la serverul de autentificare.",
          action: "Apasă din nou pe buton — cererea a fost oprită, nu rămâne blocată.",
        });
      } else {
        addDiagnostic("email", "ERROR", error instanceof Error ? error.message : String(error));
        handleAuthError(error);
      }

    } finally {
      setSubmitting(false);
      addDiagnostic("email", "REQUEST_FINISHED");
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

        <section className="mt-4 rounded-lg border border-border bg-surface/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <Bug className="size-4" /> Diagnostic autentificare
            </div>
            <Button
              type="button"
              size="sm"
              variant={diagnosticEnabled ? "default" : "outline"}
              onClick={() => {
                const next = !diagnosticEnabled;
                setDebugEnabled(next);
                setDiagnosticEnabled(next);
                addDiagnostic("sistem", next ? "DIAGNOSTIC_ENABLED" : "DIAGNOSTIC_DISABLED");
              }}
            >
              {diagnosticEnabled ? "Activ" : "Activează"}
            </Button>
          </div>
          {diagnosticEnabled && (
            <div className="mt-3 space-y-2 text-xs">
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">Client ID runtime:</strong>{" "}
                {runtimeClientId ?? (isNative ? "se încarcă…" : "OAuth web managed")}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">Package instalat:</strong>{" "}
                {signatureInfo?.packageName ?? (isNative ? "necomunicat" : "n/a (web)")}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">Versiune instalată:</strong>{" "}
                {signatureInfo?.versionName ?? "necomunicată"} (versionCode{" "}
                {signatureInfo?.versionCode ?? "necomunicat"})
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">Sursă instalare:</strong>{" "}
                {describeInstallSource(signatureInfo)}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">Installer package:</strong>{" "}
                {signatureInfo?.installerPackage ?? (isNative ? "necomunicat" : "n/a (web)")}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">SHA-1 semnătură build:</strong>{" "}
                {signatureInfo?.sha1 ?? signatureInfo?.note ?? "indisponibil"}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">SHA-256 semnătură build:</strong>{" "}
                {signatureInfo?.sha256 ?? "indisponibil"}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">Certificat identificat:</strong>{" "}
                {certificateMatch.label}
              </p>
              {signatureInfo?.sha1 && (
                <p className="text-muted-foreground">
                  Acest SHA-1 trebuie să existe în clientul OAuth <strong>Android</strong> pentru
                  package <code>app.suzeta</code>. Internal App Sharing resemnează cu certificatul
                  său separat; installer-ul Play singur nu diferențiază track-ul, certificatul o face.
                </p>
              )}

              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">serverClientId (Web Client ID):</strong>{" "}
                {runtimeClientId ?? (isNative ? "nerezolvat" : "OAuth web managed")}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">Plugin inițializat o singură dată:</strong>{" "}
                {googleRuntime
                  ? `${googleRuntime.initializeCalls === 1 ? "DA" : "NU"} (apeluri initialize=${googleRuntime.initializeCalls})`
                  : "necunoscut până la prima încercare"}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">O singură cerere Google activă:</strong>{" "}
                {googleRuntime
                  ? `${googleRuntime.concurrentRequestsBlocked === 0 ? "DA" : "NU"} (cereri concurente blocate=${googleRuntime.concurrentRequestsBlocked})`
                  : "necunoscut până la prima încercare"}
              </p>
              <p className="break-all text-muted-foreground">
                <strong className="text-foreground">Timp buton → anulare/răspuns:</strong>{" "}
                {googleRuntime?.lastElapsedMs !== null && googleRuntime?.lastElapsedMs !== undefined
                  ? `${googleRuntime.lastElapsedMs} ms (rezultat: ${googleRuntime.lastOutcome ?? "-"})`
                  : "nemăsurat încă"}
              </p>
              {googleRuntime?.attempts?.length ? (
                <div className="rounded border border-border bg-background p-2 font-mono">
                  <p className="mb-1 font-semibold">Încercări SDK</p>
                  {googleRuntime.attempts.map((a, i) => (
                    <p key={`${a.label}-${i}`} className="break-words">
                      {a.label} · {a.elapsedMs} ms · {a.outcome}
                    </p>
                  ))}
                </div>
              ) : null}

              {nativeGoogleLogs.length > 0 && (
                <div className="rounded border border-border bg-background p-2 font-mono">
                  <p className="mb-1 font-semibold">Log nativ Google (echivalentul liniilor relevante logcat)</p>
                  {nativeGoogleLogs.map((entry, index) => (
                    <p key={`${entry.at ?? 0}-${index}`} className="break-words">
                      {entry.stage ?? "unknown"} · {entry.exception ?? "fără excepție"} · numeric={entry.numericCode ?? "neemis de API"} · {entry.message ?? ""}
                      {entry.cause ? ` · cauză=${entry.cause}` : ""}
                      {entry.stack ? `\n${entry.stack}` : ""}
                    </p>
                  ))}
                </div>
              )}

              {nativeLogcat.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded border border-border bg-background p-2 font-mono">
                  <p className="mb-1 font-semibold">Logcat filtrat (CredentialManager / GoogleAuth / Identity / SocialLogin / Supabase Auth)</p>
                  {nativeLogcat.map((line, index) => (
                    <p key={`${index}-${line.slice(0, 20)}`} className="break-words">{line}</p>
                  ))}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto rounded border border-border bg-background p-2 font-mono" aria-live="polite">
                {diagnosticLines.length === 0 ? (
                  <p className="text-muted-foreground">Apasă Google sau autentificarea cu email. Pașii apar aici.</p>
                ) : diagnosticLines.map((line, index) => (
                  <p key={`${line.at}-${index}`} className="mb-1 break-words">
                    [{line.at.slice(11, 19)}] {line.flow.toUpperCase()} · {line.status}
                    {line.detail ? ` · ${line.detail}` : ""}
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const health = await supabaseHealthCheck(6000);
                    const payload = {
                      build: `${MOBILE_VERSION_CODE} · ${shortBuildSha}`,
                      packageName: signatureInfo?.packageName ?? "app.suzeta (necomunicat de runtime)",
                      versionName: signatureInfo?.versionName,
                      versionCode: signatureInfo?.versionCode,
                      installSource: describeInstallSource(signatureInfo),
                      platform: isNative ? "android-native" : "web",
                      online: typeof navigator === "undefined" ? null : navigator.onLine,
                      supabase: { ...inspectSupabaseConfig(), health },
                      turnstile: captchaRequired ? (captchaToken ? "token_received" : "pending") : "skipped_native",
                      stages: readAuthStages(),
                      serverClientId: runtimeClientId,
                      clientId: runtimeClientId,
                      signature: signatureInfo,
                      certificateMatch,
                      googleRuntime,
                      logcat: nativeLogcat,
                      nativeGoogleLogs,
                      diagnostics: diagnosticLines,
                      network: getEntries().filter((entry) => entry.source.startsWith("auth.") || entry.source === "fetch"),
                    };
                    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                    toast.success("Diagnosticul a fost copiat");
                  }}
                >
                  <Copy className="size-3.5" /> Copy diagnostics
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDiagnosticLines([]);
                    clearEntries();
                  }}
                >
                  <Trash2 className="size-3.5" /> Golește
                </Button>
              </div>
            </div>
          )}
        </section>


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
