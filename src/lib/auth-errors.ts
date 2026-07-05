// Centralized mapping for Supabase Auth + project-specific errors → friendly copy.
// Used by /auth, /auth/check-email and the discover flow so the UX is consistent.
//
// The raw Supabase Auth server returns messages in English. This mapper detects
// the error kind and returns:
//   - a stable `code` for UI branching (retry button, redirect to check-email…)
//   - an `i18nKey` + optional `values` so components can render the message in
//     the user's selected language via i18next
//   - a Romanian `message` fallback used when no translator is available (and
//     to keep legacy call sites + tests working).

import type { TFunction } from "i18next";

export type FriendlyAuthError = {
  /** Stable code for branching in UI (retry button, redirect to check-email, etc). */
  code:
    | "captcha_missing"
    | "captcha_failed"
    | "rate_limited"
    | "email_not_confirmed"
    | "invalid_credentials"
    | "user_already_exists"
    | "weak_password"
    | "email_invalid"
    | "disposable_email"
    | "network"
    | "age_required"
    | "signup_throttled"
    | "unknown";
  /** i18next key rendering the message in the user's language. */
  i18nKey: string;
  /** Interpolation values for i18nKey (e.g. { s: retryAfterSec }). */
  values?: Record<string, string | number>;
  /** Romanian fallback rendered when no translator is provided. */
  message: string;
  /** If set, UI should suggest waiting this many seconds before retrying. */
  retryAfterSec?: number;
  /** If true, UI should reset the Turnstile widget (token consumed/invalid). */
  resetCaptcha?: boolean;
};

function parseRetryAfter(raw: string): number | undefined {
  const m = raw.match(/after\s+(\d+)\s*seconds?/i) ?? raw.match(/(\d+)\s*seconds?/i);
  if (m) return Number(m[1]);
  return undefined;
}

export function mapAuthError(err: unknown): FriendlyAuthError {
  if (!err) {
    return {
      code: "unknown",
      i18nKey: "authErrors.unknown",
      message: "A apărut o eroare. Te rugăm reîncearcă.",
    };
  }

  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message ?? "")
          : "";
  const msg = raw.toLowerCase();

  // CAPTCHA
  if (msg.includes("captcha") && (msg.includes("missing") || msg.includes("required"))) {
    return {
      code: "captcha_missing",
      i18nKey: "authErrors.captchaMissing",
      message: "Completează verificarea anti-bot înainte de a continua.",
      resetCaptcha: true,
    };
  }
  if (msg.includes("captcha") || msg.includes("turnstile")) {
    return {
      code: "captcha_failed",
      i18nKey: "authErrors.captchaFailed",
      message: "Verificarea anti-bot a eșuat. Reîncearcă în câteva secunde.",
      resetCaptcha: true,
    };
  }

  // RATE LIMIT
  if (
    msg.includes("rate limit") ||
    msg.includes("rate-limit") ||
    msg.includes("too many") ||
    msg.includes("over_email_send_rate_limit") ||
    msg.includes("over_request_rate_limit") ||
    msg.includes("429")
  ) {
    const retry = parseRetryAfter(raw) ?? 60;
    return {
      code: "rate_limited",
      i18nKey: "authErrors.rateLimited",
      values: { s: retry },
      message:
        retry > 0
          ? `Prea multe încercări. Așteaptă ${retry} secunde și reîncearcă.`
          : "Prea multe încercări. Așteaptă un minut și reîncearcă.",
      retryAfterSec: retry,
      resetCaptcha: true,
    };
  }

  // EMAIL NOT CONFIRMED
  if (
    msg.includes("email not confirmed") ||
    msg.includes("email_not_confirmed") ||
    msg.includes("confirmation")
  ) {
    return {
      code: "email_not_confirmed",
      i18nKey: "authErrors.emailNotConfirmed",
      message: "Confirmă-ți emailul ca să continui. Verifică inbox-ul (și Spam).",
    };
  }

  // INVALID CREDENTIALS
  if (
    msg.includes("invalid login") ||
    msg.includes("invalid_credentials") ||
    msg.includes("invalid credentials")
  ) {
    return {
      code: "invalid_credentials",
      i18nKey: "authErrors.invalidCredentials",
      message: "Email sau parolă incorectă.",
      resetCaptcha: true,
    };
  }

  // ALREADY REGISTERED
  if (
    msg.includes("already registered") ||
    msg.includes("user already") ||
    msg.includes("already exists")
  ) {
    return {
      code: "user_already_exists",
      i18nKey: "authErrors.userAlreadyExists",
      message: "Există deja un cont cu acest email. Încearcă autentificarea.",
    };
  }

  // WEAK PASSWORD
  if (
    msg.includes("password") &&
    (msg.includes("weak") || msg.includes("short") || msg.includes("characters"))
  ) {
    return {
      code: "weak_password",
      i18nKey: "authErrors.weakPassword",
      message: "Parolă prea slabă. Folosește minim 8 caractere, litere și cifre.",
    };
  }

  // EMAIL INVALID
  if (msg.includes("invalid email") || msg.includes("email_address_invalid")) {
    return {
      code: "email_invalid",
      i18nKey: "authErrors.emailInvalid",
      message: "Adresa de email nu pare validă.",
    };
  }

  // DISPOSABLE EMAIL (server-side block via public.is_disposable_email)
  if (msg.includes("disposable_email_not_allowed") || msg.includes("disposable")) {
    return {
      code: "disposable_email",
      i18nKey: "authErrors.disposableEmail",
      message:
        "Email temporar nepermis. Folosește un email real (Gmail, Outlook, Yahoo, ProtonMail sau domeniul tău).",
    };
  }

  // AGE
  if (msg.includes("age_verification_required")) {
    return {
      code: "age_required",
      i18nKey: "authErrors.ageRequired",
      message: "Trebuie să-ți verifici vârsta înainte de a continua.",
    };
  }

  // SIGNUP THROTTLE (IP / device fingerprint)
  if (msg.includes("signup_throttled_ip")) {
    return {
      code: "signup_throttled",
      i18nKey: "authErrors.signupThrottledIp",
      message: "Prea multe conturi create de pe această conexiune. Încearcă din nou peste o oră.",
      retryAfterSec: 3600,
      resetCaptcha: true,
    };
  }
  if (msg.includes("signup_throttled_fingerprint") || msg.includes("signup_throttled")) {
    return {
      code: "signup_throttled",
      i18nKey: "authErrors.signupThrottledDevice",
      message: "Prea multe conturi create de pe acest dispozitiv. Încearcă din nou peste o oră.",
      retryAfterSec: 3600,
      resetCaptcha: true,
    };
  }

  // NETWORK
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return {
      code: "network",
      i18nKey: "authErrors.network",
      message: "Conexiune instabilă. Verifică internetul și reîncearcă.",
    };
  }

  return {
    code: "unknown",
    i18nKey: "authErrors.unknown",
    message: raw || "A apărut o eroare. Te rugăm reîncearcă.",
  };
}

/**
 * Wraps `mapAuthError` and localizes the message through i18next.
 * Falls back to the Romanian `message` if the key is missing in the active
 * bundle (defensive — should never happen because both ro/en define the full
 * `authErrors.*` namespace).
 */
export function translateAuthError(t: TFunction, err: unknown): FriendlyAuthError {
  const mapped = mapAuthError(err);
  const translated = t(mapped.i18nKey, {
    defaultValue: mapped.message,
    ...(mapped.values ?? {}),
  });
  return { ...mapped, message: translated };
}
