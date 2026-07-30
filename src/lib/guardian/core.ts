/**
 * SUZETA AUTONOMOUS APP GUARDIAN — nucleu pur (fără efecte secundare).
 *
 * Conține: redaction (PII/token), clasificare pe categorii, severitate,
 * fingerprinting pentru gruparea incidentelor și decision engine.
 *
 * REGULI (vezi AGENTS.md):
 *  - Nu se loghează NICIODATĂ token-uri, parole, email-uri, coordonate,
 *    conținut de mesaj sau câmpuri de sănătate.
 *  - Decision engine nu poate returna „auto" pentru domenii interzise
 *    (plăți, RLS, schema, auth, secrete, moderare, ștergeri).
 */

export type GuardianSeverity = "low" | "medium" | "high" | "critical";

export type GuardianCategory =
  | "javascript"
  | "react"
  | "promise"
  | "api"
  | "supabase"
  | "auth"
  | "google_auth"
  | "session"
  | "database"
  | "chat"
  | "matching"
  | "photos"
  | "notifications"
  | "payments"
  | "permissions"
  | "geolocation"
  | "performance"
  | "routing"
  | "network"
  | "timeout"
  | "capacitor"
  | "config"
  | "unknown";

export type GuardianDecision =
  | "A_auto_repair"
  | "B_fallback"
  | "C_feature_flag"
  | "D_rollback"
  | "E_approval"
  | "F_escalate";

/** Domenii în care NU se face nimic automat — doar aprobare umană. */
export const FORBIDDEN_AUTO_CATEGORIES: GuardianCategory[] = [
  "payments",
  "auth",
  "google_auth",
  "database",
];

const REDACTIONS: Array<[RegExp, string]> = [
  // JWT / bearer
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[REDACTED_JWT]"],
  [/(bearer\s+)[A-Za-z0-9._-]{12,}/gi, "$1[REDACTED_TOKEN]"],
  [/\b(sb_(secret|publishable)_[A-Za-z0-9_-]{6,})\b/g, "[REDACTED_KEY]"],
  [/("?(access_token|refresh_token|api[_-]?key|apikey|password|secret|authorization)"?\s*[:=]\s*)("?)[^"&,\s}]+/gi, '$1$3[REDACTED]'],
  // email
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]"],
  // telefon
  [/\+?\d[\d\s().-]{8,}\d/g, "[REDACTED_PHONE]"],
  // coordonate (lat,lng) — regula de locație
  [/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g, "[REDACTED_COORDS]"],
];

/** Curăță un text de orice dată sensibilă înainte de a fi trimis la server. */
export function redact(input: string | undefined | null, max = 2000): string {
  if (!input) return "";
  let out = String(input);
  for (const [re, rep] of REDACTIONS) out = out.replace(re, rep);
  return out.slice(0, max);
}

/** Elimină query string-ul (poate conține token-uri) dintr-un URL. */
export function safeUrl(u: string): string {
  try {
    const url = new URL(u, typeof window !== "undefined" ? window.location.origin : "http://x");
    return `${url.origin}${url.pathname}`;
  } catch {
    return redact(u, 200);
  }
}

const CATEGORY_RULES: Array<[RegExp, GuardianCategory]> = [
  [/revenuecat|purchase|billing|subscription|abonament|invoice/i, "payments"],
  [/google.*(sign|oauth|auth)|gsi|id_token|idtoken/i, "google_auth"],
  [/refresh[_ ]?token|session (expired|missing)|jwt expired|invalid_grant|auth session/i, "session"],
  [/auth|login|signup|sign in|unauthorized|401/i, "auth"],
  [/row-level security|rls|permission denied|42501|postgres|pgrst|relation .* does not exist/i, "database"],
  [/supabase|postgrest|realtime/i, "supabase"],
  [/message|conversation|chat/i, "chat"],
  [/swipe|match|discover/i, "matching"],
  [/upload|photo|image|storage|avatar/i, "photos"],
  [/notification|push|fcm|apns|service worker/i, "notifications"],
  [/permission|denied by permissions policy|notallowederror/i, "permissions"],
  [/geolocation|position unavailable|locație/i, "geolocation"],
  [/capacitor|cordova|native plugin|plugin .* not implemented/i, "capacitor"],
  [/timeout|timed out|aborted/i, "timeout"],
  [/failed to fetch|networkerror|load failed|err_internet|offline/i, "network"],
  [/404|not found route|no route matches/i, "routing"],
  [/missing .*environment|env var|is not configured|missing supabase/i, "config"],
  [/dynamically imported module|chunk|importing a module script failed/i, "javascript"],
  [/minified react error|hydration|render(ed)? (more|fewer) hooks|react/i, "react"],
  [/unhandled(rejection)?|promise/i, "promise"],
  [/long task|lcp|inp|cls|slow/i, "performance"],
  [/\b(4\d\d|5\d\d)\b/, "api"],
];

export function classify(message: string, hintCategory?: GuardianCategory): GuardianCategory {
  if (hintCategory) return hintCategory;
  const m = message || "";
  for (const [re, cat] of CATEGORY_RULES) if (re.test(m)) return cat;
  return "unknown";
}

export function severityFor(category: GuardianCategory, message: string): GuardianSeverity {
  const m = (message || "").toLowerCase();
  if (
    category === "payments" ||
    category === "database" ||
    /permission denied|rls|data loss|corrupt|white screen/.test(m)
  )
    return "critical";
  if (
    category === "auth" ||
    category === "google_auth" ||
    category === "session" ||
    category === "chat" ||
    category === "react" ||
    category === "supabase"
  )
    return "high";
  if (category === "performance" || category === "routing") return "low";
  return "medium";
}

/** Fingerprint stabil (grupare incidente): categorie + mesaj normalizat + top frame. */
export function fingerprint(category: string, message: string, stack?: string): string {
  const norm = (message || "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/https?:\/\/[^\s)"']+/g, "<url>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const frame =
    (stack || "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("at ")) ?? "";
  const frameNorm = frame.replace(/:\d+:\d+/g, "").replace(/\?[^)\s]*/g, "").slice(0, 80);
  return `${category}|${norm}|${frameNorm}`.slice(0, 200);
}

export type GuardianPlan = {
  decision: GuardianDecision;
  /** Poate fi executat automat de client (reversibil + risc mic). */
  autoSafe: boolean;
  risk: "low" | "medium" | "high";
  reversible: boolean;
  action:
    | "retry"
    | "refresh_session"
    | "reconnect_realtime"
    | "clear_cache"
    | "use_cached_data"
    | "reload_images"
    | "safe_route"
    | "reload_app"
    | "none";
  summary: string;
};

/**
 * Decision engine. NU decide niciodată automat pe domenii interzise:
 * plăți, abonamente, RLS, permisiuni admin, schema DB, ștergeri, auth,
 * secrete, termeni legali, moderare, banare — acolo cere aprobare umană.
 */
export function decide(input: {
  category: GuardianCategory;
  severity: GuardianSeverity;
  message: string;
  occurrences?: number;
}): GuardianPlan {
  const { category, severity, message } = input;
  const occurrences = input.occurrences ?? 1;
  const forbidden = FORBIDDEN_AUTO_CATEGORIES.includes(category);

  if (forbidden) {
    return {
      decision: severity === "critical" ? "F_escalate" : "E_approval",
      autoSafe: false,
      risk: "high",
      reversible: false,
      action: "none",
      summary: `Domeniu protejat (${category}) — necesită aprobare umană. Nicio acțiune automată.`,
    };
  }

  if (category === "session" || /jwt expired|refresh token|session (expired|missing)/i.test(message)) {
    return {
      decision: "A_auto_repair",
      autoSafe: true,
      risk: "low",
      reversible: true,
      action: "refresh_session",
      summary: "Sesiune expirată — reîmprospătare token (reversibil).",
    };
  }

  if (/dynamically imported module|chunk|importing a module script failed/i.test(message)) {
    return {
      decision: "A_auto_repair",
      autoSafe: true,
      risk: "low",
      reversible: true,
      action: "clear_cache",
      summary: "Cod vechi în cache după publicare — curățare cache + reîncărcare.",
    };
  }

  if (category === "network" || category === "timeout" || category === "api") {
    return {
      decision: occurrences > 5 ? "B_fallback" : "A_auto_repair",
      autoSafe: true,
      risk: "low",
      reversible: true,
      action: occurrences > 5 ? "use_cached_data" : "retry",
      summary:
        occurrences > 5
          ? "Rețea instabilă repetat — servire din cache (fallback temporar)."
          : "Cerere eșuată temporar — reîncercare cu backoff.",
    };
  }

  if (category === "supabase") {
    return {
      decision: "A_auto_repair",
      autoSafe: true,
      risk: "low",
      reversible: true,
      action: "reconnect_realtime",
      summary: "Conexiune backend întreruptă — reconectare realtime.",
    };
  }

  if (category === "photos") {
    return {
      decision: "A_auto_repair",
      autoSafe: true,
      risk: "low",
      reversible: true,
      action: "reload_images",
      summary: "Imagine neîncărcată — reîncercare încărcare media.",
    };
  }

  if (category === "routing") {
    return {
      decision: "B_fallback",
      autoSafe: true,
      risk: "low",
      reversible: true,
      action: "safe_route",
      summary: "Rută invalidă — revenire la o rută sigură.",
    };
  }

  if (category === "react" && occurrences >= 10) {
    return {
      decision: "C_feature_flag",
      autoSafe: false,
      risk: "medium",
      reversible: true,
      action: "none",
      summary: "Crash repetat de UI — propunere dezactivare funcție prin feature flag (aprobare).",
    };
  }

  if (severity === "critical") {
    return {
      decision: "F_escalate",
      autoSafe: false,
      risk: "high",
      reversible: false,
      action: "none",
      summary: "Incident critic — escaladare imediată către administrator.",
    };
  }

  return {
    decision: severity === "high" ? "E_approval" : "B_fallback",
    autoSafe: severity !== "high",
    risk: severity === "high" ? "medium" : "low",
    reversible: true,
    action: severity === "high" ? "none" : "retry",
    summary:
      severity === "high"
        ? "Necesită analiză/aprobare — nicio acțiune automată aplicată."
        : "Remediere ușoară: reîncercare, altfel raport programat.",
  };
}
