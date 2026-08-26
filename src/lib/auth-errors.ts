// Centralized mapping for Supabase Auth + project-specific errors → friendly copy.
// Used by /auth, /auth/check-email, /reset-password, /n (onboarding) and the
// discover flow so the UX is consistent.
//
// Each mapped error carries THREE things:
//   - `code`     — stable identifier for UI branching (retry button, redirect…)
//   - `message`  — WHAT went wrong, short and human ("Email sau parolă incorectă.")
//   - `action`   — WHAT TO DO next, actionable and specific
//                  ("Verifică datele și încearcă din nou, sau recuperează parola.")
//
// `i18nKey` / `actionKey` render the same content in the user's active language
// via i18next; the Romanian `message` / `action` are the fallback used when no
// translator is provided (also keeps legacy call sites + tests working).

import type { TFunction } from "i18next";
import { toast } from "sonner";

export type FriendlyAuthErrorCode =
  | "captcha_missing"
  | "captcha_failed"
  | "rate_limited"
  | "email_not_confirmed"
  | "invalid_credentials"
  | "user_already_exists"
  | "weak_password"
  | "same_password"
  | "passwords_dont_match"
  | "email_invalid"
  | "disposable_email"
  | "email_bounced"
  | "network"
  | "age_required"
  | "signup_throttled"
  | "signup_disabled"
  | "session_expired"
  | "otp_invalid"
  | "otp_expired"
  | "phone_invalid"
  | "provider_error"
  | "consent_required"
  | "health_consent_required"
  | "storage_too_big"
  | "storage_bad_type"
  | "storage_generic"
  | "unknown";

export type FriendlyAuthError = {
  code: FriendlyAuthErrorCode;
  /** i18next key for the short "what went wrong" message. */
  i18nKey: string;
  /** i18next key for the actionable "what to do next" hint. */
  actionKey: string;
  /** Interpolation values (e.g. { s: retryAfterSec }). */
  values?: Record<string, string | number>;
  /** Romanian fallback for the short message. */
  message: string;
  /** Romanian fallback for the actionable next-step hint. */
  action: string;
  /** If set, UI should suggest waiting this many seconds before retrying. */
  retryAfterSec?: number;
  /** If true, UI should reset the Turnstile widget. */
  resetCaptcha?: boolean;
};

function parseRetryAfter(raw: string): number | undefined {
  const m = raw.match(/after\s+(\d+)\s*seconds?/i) ?? raw.match(/(\d+)\s*seconds?/i);
  if (m) return Number(m[1]);
  return undefined;
}

// eslint-disable-next-line complexity
export function mapAuthError(err: unknown): FriendlyAuthError {
  if (!err) {
    return {
      code: "unknown",
      i18nKey: "authErrors.unknown",
      actionKey: "authErrors.actions.retry",
      message: "A apărut o eroare.",
      action: "Reîncearcă în câteva secunde. Dacă persistă, revino mai târziu.",
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
      actionKey: "authErrors.actions.captchaMissing",
      message: "Verificarea anti-bot lipsește.",
      action: 'Bifează caseta „Nu sunt robot” din partea de jos a formularului.',
      resetCaptcha: true,
    };
  }
  if (msg.includes("captcha") || msg.includes("turnstile")) {
    return {
      code: "captcha_failed",
      i18nKey: "authErrors.captchaFailed",
      actionKey: "authErrors.actions.captchaFailed",
      message: "Verificarea anti-bot a eșuat.",
      action: "Reîmprospătează pagina și încearcă din nou. Dezactivează VPN-ul dacă folosești unul.",
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
      actionKey: "authErrors.actions.rateLimited",
      values: { s: retry },
      message:
        retry > 0
          ? `Prea multe încercări. Așteaptă ${retry} secunde.`
          : "Prea multe încercări. Așteaptă un minut.",
      action: "Contorul se resetează automat. Nu apăsa butonul repetat.",
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
      actionKey: "authErrors.actions.emailNotConfirmed",
      message: "Emailul nu e confirmat.",
      action: "Deschide inboxul (și folderul Spam) și dă click pe linkul de confirmare.",
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
      actionKey: "authErrors.actions.invalidCredentials",
      message: "Email sau parolă incorectă.",
      action: 'Verifică majuscule și caractere speciale. Dacă ai uitat parola, folosește „Am uitat parola”.',
      resetCaptcha: true,
    };
  }

  // SAME PASSWORD (on updateUser)
  if (msg.includes("same_password") || msg.includes("should be different from the old")) {
    return {
      code: "same_password",
      i18nKey: "authErrors.samePassword",
      actionKey: "authErrors.actions.samePassword",
      message: "Parola nouă e identică cu cea veche.",
      action: "Alege o parolă diferită de cea folosită anterior.",
    };
  }

  // RECOVERY SESSION / LINK EXPIRED
  if (
    msg.includes("session_not_found") ||
    msg.includes("auth session missing") ||
    msg.includes("invalid jwt") ||
    msg.includes("jwt expired") ||
    msg.includes("token has expired")
  ) {
    return {
      code: "session_expired",
      i18nKey: "authErrors.sessionExpired",
      actionKey: "authErrors.actions.sessionExpired",
      message: "Linkul de resetare a expirat.",
      action: "Cere un link nou din ecranul de autentificare și folosește-l o singură dată.",
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
      actionKey: "authErrors.actions.userAlreadyExists",
      message: "Există deja un cont cu acest email.",
      action: "Autentifică-te cu parola pe care ai setat-o, sau folosește „Am uitat parola”.",
    };
  }

  // WEAK PASSWORD
  if (
    msg.includes("password") &&
    (msg.includes("weak") ||
      msg.includes("short") ||
      msg.includes("characters") ||
      msg.includes("pwned"))
  ) {
    const pwned = msg.includes("pwned") || msg.includes("compromised");
    return {
      code: "weak_password",
      i18nKey: pwned ? "authErrors.weakPasswordPwned" : "authErrors.weakPassword",
      actionKey: "authErrors.actions.weakPassword",
      message: pwned
        ? "Această parolă a fost expusă în scurgeri publice."
        : "Parolă prea slabă.",
      action:
        "Folosește minim 8 caractere, cu litere mari și mici, cifre și un simbol. Nu refolosi parole de pe alte site-uri.",
    };
  }

  // EMAIL INVALID
  if (msg.includes("invalid email") || msg.includes("email_address_invalid")) {
    return {
      code: "email_invalid",
      i18nKey: "authErrors.emailInvalid",
      actionKey: "authErrors.actions.emailInvalid",
      message: "Adresa de email nu pare validă.",
      action: "Verifică formatul (ex: nume@domeniu.ro) și dacă nu ai spații la început sau final.",
    };
  }

  // EMAIL BOUNCED
  if (msg.includes("email_send_failed") || msg.includes("bounce")) {
    return {
      code: "email_bounced",
      i18nKey: "authErrors.emailBounced",
      actionKey: "authErrors.actions.emailBounced",
      message: "Nu am putut trimite emailul la această adresă.",
      action: "Verifică că adresa există, sau încearcă cu un alt email (Gmail, Outlook, ProtonMail).",
    };
  }

  // DISPOSABLE EMAIL
  if (msg.includes("disposable_email_not_allowed") || msg.includes("disposable")) {
    return {
      code: "disposable_email",
      i18nKey: "authErrors.disposableEmail",
      actionKey: "authErrors.actions.disposableEmail",
      message: "Email temporar nepermis.",
      action:
        "Folosește un email real: Gmail, Outlook, Yahoo, ProtonMail sau propriul tău domeniu.",
    };
  }

  // AGE
  if (msg.includes("age_verification_required")) {
    return {
      code: "age_required",
      i18nKey: "authErrors.ageRequired",
      actionKey: "authErrors.actions.ageRequired",
      message: "Trebuie să-ți verifici vârsta.",
      action: "Mergi la „Verificare vârstă” din meniu și urmează pașii (selfie + document).",
    };
  }

  // SIGNUP THROTTLE
  if (msg.includes("signup_throttled_ip")) {
    return {
      code: "signup_throttled",
      i18nKey: "authErrors.signupThrottledIp",
      actionKey: "authErrors.actions.signupThrottled",
      message: "Prea multe conturi create de pe această conexiune.",
      action: "Așteaptă o oră sau conectează-te la alt Wi-Fi/date mobile.",
      retryAfterSec: 3600,
      resetCaptcha: true,
    };
  }
  if (msg.includes("signup_throttled_fingerprint") || msg.includes("signup_throttled")) {
    return {
      code: "signup_throttled",
      i18nKey: "authErrors.signupThrottledDevice",
      actionKey: "authErrors.actions.signupThrottled",
      message: "Prea multe conturi create de pe acest dispozitiv.",
      action: "Așteaptă o oră. Dacă e greșit, contactează suportul.",
      retryAfterSec: 3600,
      resetCaptcha: true,
    };
  }

  // SIGNUP DISABLED
  if (msg.includes("signup_disabled") || msg.includes("signups not allowed")) {
    return {
      code: "signup_disabled",
      i18nKey: "authErrors.signupDisabled",
      actionKey: "authErrors.actions.signupDisabled",
      message: "Înregistrările sunt momentan închise.",
      action: "Revino mai târziu sau înscrie-te pe lista de așteptare de pe site.",
    };
  }

  // SESSION EXPIRED
  if (
    msg.includes("jwt expired") ||
    msg.includes("session_not_found") ||
    msg.includes("refresh token not found") ||
    msg.includes("no user")
  ) {
    return {
      code: "session_expired",
      i18nKey: "authErrors.sessionExpired",
      actionKey: "authErrors.actions.sessionExpired",
      message: "Sesiunea a expirat.",
      action: "Autentifică-te din nou pentru a continua.",
    };
  }

  // OTP
  if (msg.includes("otp_expired") || msg.includes("token has expired")) {
    return {
      code: "otp_expired",
      i18nKey: "authErrors.otpExpired",
      actionKey: "authErrors.actions.otpExpired",
      message: "Codul a expirat.",
      action: "Cere un cod nou și introdu-l în maxim 5 minute.",
    };
  }
  if (msg.includes("invalid otp") || msg.includes("otp_invalid") || msg.includes("token is invalid")) {
    return {
      code: "otp_invalid",
      i18nKey: "authErrors.otpInvalid",
      actionKey: "authErrors.actions.otpInvalid",
      message: "Cod incorect.",
      action: "Verifică cele 6 cifre din email/SMS. Fără spații.",
    };
  }

  // PHONE
  if (msg.includes("invalid phone") || msg.includes("phone_number_invalid")) {
    return {
      code: "phone_invalid",
      i18nKey: "authErrors.phoneInvalid",
      actionKey: "authErrors.actions.phoneInvalid",
      message: "Număr de telefon invalid.",
      action: "Folosește formatul internațional cu prefix, ex: +40 7XX XXX XXX.",
    };
  }

  // OAUTH PROVIDER
  if (msg.includes("provider") && (msg.includes("error") || msg.includes("failed"))) {
    return {
      code: "provider_error",
      i18nKey: "authErrors.providerError",
      actionKey: "authErrors.actions.providerError",
      message: "Autentificarea cu contul extern a eșuat.",
      action: "Închide fereastra popup dacă e deschisă și reîncearcă. Sau folosește email + parolă.",
    };
  }

  // HEALTH CONSENT
  if (msg.includes("health_consent_required")) {
    return {
      code: "health_consent_required",
      i18nKey: "authErrors.healthConsentRequired",
      actionKey: "authErrors.actions.healthConsentRequired",
      message: "Consimțământul pentru date de sănătate lipsește.",
      action: "Bifează opțiunea „Sunt de acord cu prelucrarea datelor de sănătate” înainte de a salva.",
    };
  }
  if (msg.includes("consent_required") || msg.includes("terms_not_accepted")) {
    return {
      code: "consent_required",
      i18nKey: "authErrors.consentRequired",
      actionKey: "authErrors.actions.consentRequired",
      message: "Consimțământul lipsește.",
      action: "Bifează căsuțele obligatorii (Termeni și Confidențialitate) înainte de a continua.",
    };
  }

  // STORAGE / UPLOAD
  if (msg.includes("payload too large") || msg.includes("file too big")) {
    return {
      code: "storage_too_big",
      i18nKey: "authErrors.storageTooBig",
      actionKey: "authErrors.actions.storageTooBig",
      message: "Fișierul e prea mare.",
      action: "Maxim 8 MB per poză. Comprimă imaginea sau alege alta.",
    };
  }
  if (msg.includes("mime") || msg.includes("content-type") || msg.includes("unsupported")) {
    return {
      code: "storage_bad_type",
      i18nKey: "authErrors.storageBadType",
      actionKey: "authErrors.actions.storageBadType",
      message: "Format de fișier nesuportat.",
      action: "Folosește JPG, PNG sau WebP.",
    };
  }
  if (msg.includes("storage") || msg.includes("bucket")) {
    return {
      code: "storage_generic",
      i18nKey: "authErrors.storageGeneric",
      actionKey: "authErrors.actions.storageGeneric",
      message: "Nu am putut salva fișierul.",
      action: "Verifică internetul și reîncearcă. Dacă persistă, contactează suportul.",
    };
  }

  // NETWORK
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return {
      code: "network",
      i18nKey: "authErrors.network",
      actionKey: "authErrors.actions.network",
      message: "Conexiune instabilă.",
      action: "Verifică internetul și reîncearcă. Dacă ești pe date mobile, treci pe Wi-Fi (sau invers).",
    };
  }

  return {
    code: "unknown",
    i18nKey: "authErrors.unknown",
    actionKey: "authErrors.actions.retry",
    message: raw || "A apărut o eroare.",
    action: "Reîncearcă. Dacă problema persistă, contactează suportul cu descrierea acțiunii.",
  };
}

/**
 * Wraps `mapAuthError` and localizes both `message` and `action` through i18next.
 * Falls back to the Romanian defaults if a key is missing in the active bundle.
 */
export function translateAuthError(t: TFunction, err: unknown): FriendlyAuthError {
  const mapped = mapAuthError(err);
  const message = t(mapped.i18nKey, {
    defaultValue: mapped.message,
    ...(mapped.values ?? {}),
  });
  const action = t(mapped.actionKey, {
    defaultValue: mapped.action,
    ...(mapped.values ?? {}),
  });
  return { ...mapped, message, action };
}

/**
 * Shows a sonner error toast with:
 *   - title  = short "what happened"
 *   - description = actionable "what to do"
 * Also returns the mapped error so callers can branch on `code`, apply
 * `retryAfterSec`, reset captcha, etc.
 */
export function showAuthErrorToast(t: TFunction, err: unknown): FriendlyAuthError {
  const mapped = translateAuthError(t, err);
  toast.error(mapped.message, {
    description: mapped.action,
    duration: mapped.retryAfterSec && mapped.retryAfterSec > 30 ? 8000 : 5500,
  });
  // Emitem eveniment pentru debug-logger (mod loguri detaliate).
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("suzeta:auth-error", {
          detail: {
            code: mapped.code,
            message: mapped.message,
            action: mapped.action,
            raw: err instanceof Error ? err.message : String(err ?? ""),
          },
        }),
      );
    } catch {
      /* noop */
    }
  }
  return mapped;
}
