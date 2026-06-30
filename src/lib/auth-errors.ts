// Centralized mapping for Supabase Auth + project-specific errors → friendly RO copy.
// Used by /auth, /auth/check-email and the discover flow so the UX is consistent.

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
  /** Romanian user-facing message. Short, actionable. */
  message: string;
  /** If set, UI should suggest waiting this many seconds before retrying. */
  retryAfterSec?: number;
  /** If true, UI should reset the Turnstile widget (token consumed/invalid). */
  resetCaptcha?: boolean;
};

function parseRetryAfter(raw: string): number | undefined {
  // Supabase rate-limit messages sometimes embed "after N seconds".
  const m = raw.match(/after\s+(\d+)\s*seconds?/i) ?? raw.match(/(\d+)\s*seconds?/i);
  if (m) return Number(m[1]);
  return undefined;
}

export function mapAuthError(err: unknown): FriendlyAuthError {
  if (!err) return { code: "unknown", message: "A apărut o eroare. Te rugăm reîncearcă." };

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
      message: "Completează verificarea anti-bot înainte de a continua.",
      resetCaptcha: true,
    };
  }
  if (msg.includes("captcha") || msg.includes("turnstile")) {
    return {
      code: "captcha_failed",
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
      message:
        retry > 0
          ? `Prea multe încercări. Așteaptă ${retry} secunde și reîncearcă.`
          : "Prea multe încercări. Așteaptă un minut și reîncearcă.",
      retryAfterSec: retry,
      resetCaptcha: true,
    };
  }

  // EMAIL NOT CONFIRMED
  if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed") || msg.includes("confirmation")) {
    return {
      code: "email_not_confirmed",
      message: "Confirmă-ți emailul ca să continui. Verifică inbox-ul (și Spam).",
    };
  }

  // INVALID CREDENTIALS
  if (msg.includes("invalid login") || msg.includes("invalid_credentials") || msg.includes("invalid credentials")) {
    return {
      code: "invalid_credentials",
      message: "Email sau parolă incorectă.",
      resetCaptcha: true,
    };
  }

  // ALREADY REGISTERED
  if (msg.includes("already registered") || msg.includes("user already") || msg.includes("already exists")) {
    return {
      code: "user_already_exists",
      message: "Există deja un cont cu acest email. Încearcă autentificarea.",
    };
  }

  // WEAK PASSWORD
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("short") || msg.includes("characters"))) {
    return { code: "weak_password", message: "Parolă prea slabă. Folosește minim 8 caractere, litere și cifre." };
  }

  // EMAIL INVALID
  if (msg.includes("invalid email") || msg.includes("email_address_invalid")) {
    return { code: "email_invalid", message: "Adresa de email nu pare validă." };
  }

  // DISPOSABLE EMAIL (server-side block via public.is_disposable_email)
  if (msg.includes("disposable_email_not_allowed") || msg.includes("disposable")) {
    return {
      code: "disposable_email",
      message:
        "Email temporar nepermis. Folosește un email real (Gmail, Outlook, Yahoo, ProtonMail sau domeniul tău).",
    };
  }

  // AGE
  if (msg.includes("age_verification_required")) {
    return { code: "age_required", message: "Trebuie să-ți verifici vârsta înainte de a continua." };
  }

  // SIGNUP THROTTLE (IP / device fingerprint)
  if (msg.includes("signup_throttled_ip")) {
    return {
      code: "signup_throttled",
      message:
        "Prea multe conturi create de pe această conexiune. Încearcă din nou peste o oră.",
      retryAfterSec: 3600,
      resetCaptcha: true,
    };
  }
  if (msg.includes("signup_throttled_fingerprint") || msg.includes("signup_throttled")) {
    return {
      code: "signup_throttled",
      message:
        "Prea multe conturi create de pe acest dispozitiv. Încearcă din nou peste o oră.",
      retryAfterSec: 3600,
      resetCaptcha: true,
    };
  }

  // NETWORK
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return { code: "network", message: "Conexiune instabilă. Verifică internetul și reîncearcă." };
  }

  return { code: "unknown", message: raw || "A apărut o eroare. Te rugăm reîncearcă." };
}
