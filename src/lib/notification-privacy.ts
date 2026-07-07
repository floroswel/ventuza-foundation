/**
 * Reguli de confidențialitate pentru notificări.
 *
 * Regula fundamentală: conținutul mesajului (text, caption, tip media,
 * URL media) NU pleacă niciodată într-un payload de notificare decât dacă
 * destinatarul a activat explicit `notification_prefs.show_preview`.
 *
 * Toate suprafețele (push web, inbox preview, toast in-app) trec prin
 * `buildMessageNotificationBody` sau prin body-ul deja filtrat de trigger-ul
 * SQL `tg_notify_new_message`.
 */

export const GENERIC_MESSAGE_BODY = "Ai un mesaj nou";
export const GENERIC_INBOX_FALLBACK = "Say hi 👋";
/** Copy explicit când destinatarul a dezactivat preview-ul din Setări. */
export const PREVIEW_DISABLED_BODY = "Previzualizare dezactivată";
export const MAX_PREVIEW_LEN = 140;

/**
 * Body-ul afișat în notificarea push. Când destinatarul nu a activat
 * `show_preview`, întoarce mereu textul generic — indiferent ce s-a
 * întâmplat la nivel de mesaj (text, caption foto/voice, locație, media
 * kind).
 */
export function buildMessageNotificationBody(
  _showPreview: boolean,
  _preview: string | null | undefined,
): string {
  // Policy: notificările push NU expun niciodată conținutul mesajului.
  return GENERIC_MESSAGE_BODY;
}

/**
 * Preview-ul afișat în lista de conversații. Diferențiază starea:
 *   - nicio conversație activă → invitație generică (`Say hi 👋`)
 *   - show_preview OFF explicit → „Previzualizare dezactivată"
 *   - orice altă stare → „Ai un mesaj nou"
 * Nu expune niciodată textul real, indiferent de preferință.
 */
export function buildInboxPreview(
  showPreview: boolean | null | undefined,
  _lastMessagePreview: string | null | undefined,
  hasAnyMessage: boolean,
): string {
  if (!hasAnyMessage) return GENERIC_INBOX_FALLBACK;
  if (showPreview === false) return PREVIEW_DISABLED_BODY;
  return GENERIC_MESSAGE_BODY;
}

/**
 * Copy pentru toast in-app.
 *
 * Policy:
 *   - `type === "message"` → NU expune niciodată `dbBody` (chiar dacă
 *     trigger-ul DB e „safe" astăzi, un regress la nivel SQL nu trebuie
 *     să lovească UI). Cu `show_preview=false` → „Previzualizare
 *     dezactivată"; altfel „Ai un mesaj nou".
 *   - Alte tipuri (match, tap, album, etc.) → `dbBody` deja este un label
 *     scurt fără PII; se pasează așa cum e. Dacă lipsește, generic.
 */
export function buildToastBody(
  showPreview: boolean | null | undefined,
  dbBody: string | null | undefined,
  type?: string | null,
): string {
  if (type === "message" || !type) {
    if (showPreview === false) return PREVIEW_DISABLED_BODY;
    return GENERIC_MESSAGE_BODY;
  }
  const clean = (dbBody ?? "").toString().trim();
  return clean || GENERIC_MESSAGE_BODY;
}

/**
 * ============================================================
 * FILTRU CENTRAL DE SANITIZARE PAYLOAD NOTIFICĂRI
 * ============================================================
 *
 * Orice payload de notificare (push web, FCM, native, in-app toast, email)
 * trebuie să treacă prin `sanitizeNotificationPayload` ÎNAINTE să iasă din
 * server. Filtrul maschează/înlătură câmpurile potențial sensibile:
 *
 *  - conținut de mesaj (text, caption, body, preview, snippet, media_url,
 *    voice_url, transcript, translation, quoted, reply_to)
 *  - identificatori direcți (email, phone, e164, iban, cnp)
 *  - date de sănătate (hiv_status, hiv_test_date, prep, std, orice `*_enc`)
 *  - locație precisă (lat, lng, latitude, longitude, coords, geo, point,
 *    location, travel_location, prev_location, distance_m brut)
 *  - orientare/gen brute (orientation, gender, gender_custom, pronouns,
 *    pronouns_custom, tribes) — sunt Art. 9 în app queer
 *  - token-uri/credențiale (auth, p256dh, endpoint, token, access_token,
 *    refresh_token, api_key, secret, password, pin_hash)
 *  - fingerprint / IP / UA (fingerprint, ip, ip_hash, user_agent, ua_hash)
 *
 * Comportament: pentru `title`/`body` textul e înlocuit cu copy generic;
 * pentru orice alt câmp la orice adâncime, cheia sensibilă e ELIMINATĂ din
 * obiect (nu doar mascată — nu vrem urme). Stringurile rămase sunt scanate
 * pentru pattern-uri PII (email, telefon E.164, IBAN, CNP) și înlocuite cu
 * `[redacted]`.
 */

/** Chei care nu au voie să apară niciodată într-un payload de notificare. */
const FORBIDDEN_KEY_PATTERNS: RegExp[] = [
  // conținut mesaj
  /^(body|text|message|msg|content|preview|snippet|caption|transcript|translation|quoted|reply_to|last_message.*)$/i,
  /(media_url|voice_url|photo_url|attachment|audio_url|video_url|image_url|media_type|media_kind)/i,
  // sănătate (Art. 9)
  /(hiv|prep|std|health)/i,
  /_enc$/i,
  // locație precisă
  /^(lat|lng|latitude|longitude|coords?|geo|point|location|travel_location|prev_location)$/i,
  /^distance_m$/i,
  // orientare/gen brute
  /^(orientation|gender|gender_custom|pronouns|pronouns_custom|tribes)$/i,
  // identificatori direcți
  /^(email|phone|phone_e164|e164|iban|cnp|birthdate|birth_date)$/i,
  // credențiale/tokene
  /(auth|p256dh|endpoint|token|secret|password|api_key|pin_hash|refresh_token|access_token)/i,
  // fingerprint / ip / ua
  /(fingerprint|ip_hash|user_agent|ua_hash)/i,
  /^ip$/i,
];

/** Chei permise explicit chiar dacă ar match-ui accidental un pattern. */
const ALLOWED_KEYS = new Set([
  "title", "url", "tag", "type", "category", "kind", "channel",
  "id", "actor_id", "target_id", "conversation_id", "match_id",
  "created_at", "sent_at", "priority",
]);

const PII_PATTERNS: Array<[RegExp, string, PiiKind]> = [
  // email
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]", "email"],
  // IBAN (RO + generic) — MUST run before phone (phone is a greedy digit run).
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[iban]", "iban"],
  // CNP RO (13 cifre) — MUST also run before phone for the same reason.
  [/\b[1-9]\d{12}\b/g, "[cnp]", "cnp"],
  // coordonate lat,lng
  [/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g, "[coords]", "coords"],
  // telefon E.164 sau internațional (LAST — greedy digit-run).
  [/\+?\d[\d\s().-]{7,}\d/g, "[phone]", "phone"],
];


export type PiiKind = "email" | "phone" | "iban" | "cnp" | "coords";

/**
 * Structured redaction report produced alongside every sanitize call.
 *
 * Rule: NEVER contains the removed data — only the shape of what was scrubbed
 * (JSON path + kind of leak). Safe to log to console or an audit sink.
 */
export interface SanitizeRedactionReport {
  /** JSON-path pointers (RFC-6901-ish) of forbidden keys removed from `data`. */
  removedKeys: string[];
  /** Where PII patterns were matched and scrubbed inside surviving strings. */
  scrubbedStrings: Array<{ path: string; kinds: PiiKind[]; count: number }>;
  /** `true` when body was forced to the generic copy because category=messages. */
  bodyForcedGeneric: boolean;
  /** `true` when the incoming `url` had its query string dropped. */
  urlQueryDropped: boolean;
  /** `true` when title/body/tag were clamped to the max length. */
  truncated: { title: boolean; body: boolean; tag: boolean };
  /** Unknown top-level keys the sanitizer refused to propagate. */
  droppedTopLevelKeys: string[];
}

function emptyReport(): SanitizeRedactionReport {
  return {
    removedKeys: [],
    scrubbedStrings: [],
    bodyForcedGeneric: false,
    urlQueryDropped: false,
    truncated: { title: false, body: false, tag: false },
    droppedTopLevelKeys: [],
  };
}

function isForbiddenKey(key: string): boolean {
  if (ALLOWED_KEYS.has(key)) return false;
  return FORBIDDEN_KEY_PATTERNS.some((rx) => rx.test(key));
}

/** Scrub PII from a string, recording which kinds matched (not the values). */
function scrubStringTracked(
  s: string,
  path: string,
  report: SanitizeRedactionReport,
): string {
  let out = s;
  const kinds: PiiKind[] = [];
  let count = 0;
  for (const [rx, repl, kind] of PII_PATTERNS) {
    // Reset lastIndex because regexes are shared /g instances.
    rx.lastIndex = 0;
    const matches = out.match(rx);
    if (matches && matches.length > 0) {
      count += matches.length;
      if (!kinds.includes(kind)) kinds.push(kind);
      out = out.replace(rx, repl);
    }
  }
  if (kinds.length > 0) {
    report.scrubbedStrings.push({ path, kinds, count });
  }
  return out;
}

/** Backwards-compat wrapper used by internal callers that don't need tracking. */
function scrubString(s: string): string {
  let out = s;
  for (const [rx, repl] of PII_PATTERNS) out = out.replace(rx, repl);
  return out;
}

function deepStripTracked(
  value: unknown,
  path: string,
  report: SanitizeRedactionReport,
): unknown {
  if (value == null) return value;
  if (typeof value === "string") return scrubStringTracked(value, path, report);
  if (Array.isArray(value)) {
    return value.map((v, i) => deepStripTracked(v, `${path}/${i}`, report));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const childPath = `${path}/${k}`;
      if (isForbiddenKey(k)) {
        report.removedKeys.push(childPath);
        continue; // ELIMINĂ complet
      }
      out[k] = deepStripTracked(v, childPath, report);
    }
    return out;
  }
  return value;
}


export interface NotificationPayloadIn {
  title?: string | null;
  body?: string | null;
  url?: string | null;
  tag?: string | null;
  type?: string | null;
  category?: string | null;
  data?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface SanitizedNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: string;
  category?: string;
  data?: Record<string, unknown>;
}

/**
 * ============================================================
 * COMPILE-TIME GUARD: câmpuri interzise în payload-uri notificări
 * ============================================================
 *
 * TypeScript-ul refuză, la compilare, orice payload sau `data` care
 * conține unul din câmpurile care ar putea scurge conținutul mesajului
 * (text, tip media, URL media, caption). Regula e independentă de
 * `sanitizeNotificationPayload` (care e ultimul strat, la runtime): tipurile
 * blochează scurgerile ÎNAINTE ca un dev să-și dea seama că trebuia să
 * apeleze sanitizer-ul.
 *
 * Cum se folosește:
 *
 *   import { defineNotificationPayload } from "@/lib/notification-privacy";
 *
 *   const p = defineNotificationPayload({
 *     title: "Andrei",
 *     body: "Ai un mesaj nou",
 *     data: { conversation_id: "abc" },   // OK
 *   });
 *
 *   defineNotificationPayload({
 *     title: "Andrei",
 *     body: "Ai un mesaj nou",
 *     data: { media_url: "..." },         // ❌ TS2322 la compilare
 *   });
 *
 * Pentru a extinde lista de câmpuri interzise, adaugă cheia în
 * `ForbiddenNotificationField` — și `FORBIDDEN_KEYS` (runtime) în același
 * PR, ca sursa de adevăr să rămână unică.
 */
export type ForbiddenNotificationField =
  | "media_type"
  | "media_url"
  | "caption"
  | "voice_url"
  | "body_preview"
  | "last_message_preview"
  | "message_body"
  | "text";

/**
 * Marchează câmpurile interzise ca `never` pe orice tip T. Un obiect care
 * încearcă să pună o valoare pe una din chei devine incompatibil cu T și
 * TypeScript raportează eroare la compilare.
 */
export type NoForbiddenFields<T> = T & {
  readonly [K in ForbiddenNotificationField]?: never;
};

/** `data` extras — Record cu chei string, dar fără câmpurile interzise. */
export type SafeNotificationData = NoForbiddenFields<Record<string, unknown>>;

/**
 * Forma strict-tipată acceptată de canalele de notificări. Diferă de
 * `NotificationPayloadIn` (care rămâne laxă pentru a putea primi payload-uri
 * externe/necunoscute la sanitizare) prin faptul că interzice explicit
 * câmpurile de conținut la nivel top ȘI în `data`.
 */
export type SafeNotificationPayload = NoForbiddenFields<{
  title?: string | null;
  /** Body-ul afișat — permis, dar sanitizat la runtime; NU pune text mesaj. */
  body?: string | null;
  url?: string | null;
  tag?: string | null;
  type?: string | null;
  category?: string | null;
  data?: SafeNotificationData | null;
}>;

/**
 * Helper compile-time care nu face nimic la runtime, doar constrânge
 * tipul argumentului la `SafeNotificationPayload`. Folosește-l în orice
 * loc în care construiești un payload de notificare literal.
 */
export function defineNotificationPayload<T extends SafeNotificationPayload>(
  payload: T & NoForbiddenFields<T>,
): T {
  return payload;
}

/**
 * Helper compile-time echivalent pentru sub-obiectul `data`.
 */
export function defineNotificationData<T extends SafeNotificationData>(
  data: T & NoForbiddenFields<T>,
): T {
  return data;
}

/**
 * Pluggable audit sink. Register once at boot (e.g. wire it to your logging
 * pipeline in `src/start.ts` or per-runtime). Never invoked with raw values —
 * only structural metadata (paths, kinds, counts).
 */
export type SanitizeAuditLogger = (event: {
  channel?: string;
  category?: string;
  type?: string;
  report: SanitizeRedactionReport;
  hasAnyRedaction: boolean;
}) => void;

let auditLogger: SanitizeAuditLogger | null = defaultConsoleLogger;

/** Default sink: `console.warn` with a stable `[notif-sanitize]` prefix. */
function defaultConsoleLogger(event: {
  channel?: string;
  report: SanitizeRedactionReport;
  hasAnyRedaction: boolean;
}): void {
  if (!event.hasAnyRedaction) return;
  // Structured, JSON-friendly — no raw values in payload.
  // eslint-disable-next-line no-console
  console.warn("[notif-sanitize]", JSON.stringify(event));
}

/** Replace the default console sink (pass `null` to disable logging). */
export function setNotificationSanitizeLogger(logger: SanitizeAuditLogger | null): void {
  auditLogger = logger;
}

/**
 * Sanitizează un payload de notificare. Trebuie apelat de FIECARE canal
 * (web push, FCM, native, in-app, email) înainte de trimitere.
 *
 * - `title` și `body` sunt limitate la max 120/140 caractere, scrubbed de PII;
 *   dacă categoria e `messages`, `body` este forțat la `GENERIC_MESSAGE_BODY`.
 * - Orice cheie sensibilă din payload sau `data` este eliminată (nu doar
 *   mascată). Stringurile rămase sunt scanate pentru PII.
 * - Câmpurile necunoscute la nivel top se ignoră (nu se propagă mai departe).
 * - Emite un `SanitizeRedactionReport` structurat (fără valori) prin loggerul
 *   configurat cu `setNotificationSanitizeLogger`; pentru acces direct la
 *   report folosește `sanitizeNotificationPayloadWithReport`.
 */
export function sanitizeNotificationPayload(
  input: NotificationPayloadIn,
  opts?: { channel?: string },
): SanitizedNotificationPayload {
  return sanitizeNotificationPayloadWithReport(input, opts).payload;
}

/**
 * Variantă care întoarce și `SanitizeRedactionReport`. Util pentru teste și
 * pentru canale care vor să atașeze report-ul la propria telemetrie.
 */
export function sanitizeNotificationPayloadWithReport(
  input: NotificationPayloadIn,
  opts?: { channel?: string },
): { payload: SanitizedNotificationPayload; report: SanitizeRedactionReport } {
  const report = emptyReport();

  const category = typeof input.category === "string" ? input.category : undefined;
  const type = typeof input.type === "string" ? input.type : undefined;
  const isMessage =
    (category ?? "").toLowerCase() === "messages" ||
    (type ?? "").toLowerCase().includes("message");

  const rawTitle = (input.title ?? "").toString().trim() || "Ventuza";
  const rawBody = (input.body ?? "").toString().trim() || GENERIC_MESSAGE_BODY;

  const scrubbedTitle = scrubStringTracked(rawTitle, "/title", report);
  const title = scrubbedTitle.slice(0, 120);
  if (scrubbedTitle.length > 120) report.truncated.title = true;

  let body: string;
  if (isMessage) {
    body = GENERIC_MESSAGE_BODY;
    // Only note "forced generic" when the caller actually tried to pass a body.
    if (rawBody && rawBody !== GENERIC_MESSAGE_BODY) report.bodyForcedGeneric = true;
  } else {
    const scrubbedBody = scrubStringTracked(rawBody, "/body", report);
    body = scrubbedBody.slice(0, MAX_PREVIEW_LEN);
    if (scrubbedBody.length > MAX_PREVIEW_LEN) report.truncated.body = true;
  }

  const out: SanitizedNotificationPayload = { title, body };

  if (typeof input.url === "string" && input.url) {
    const hasQuery = input.url.includes("?");
    try {
      const u = new URL(input.url, "https://placeholder.local");
      out.url = u.pathname;
    } catch {
      out.url = input.url.split("?")[0].slice(0, 300);
    }
    if (hasQuery) report.urlQueryDropped = true;
  }

  if (typeof input.tag === "string" && input.tag) {
    const scrubbedTag = scrubStringTracked(input.tag, "/tag", report);
    out.tag = scrubbedTag.slice(0, 80);
    if (scrubbedTag.length > 80) report.truncated.tag = true;
  }

  if (type) out.type = type.slice(0, 40);
  if (category) out.category = category.slice(0, 40);

  if (input.data && typeof input.data === "object") {
    const stripped = deepStripTracked(input.data, "/data", report) as Record<string, unknown>;
    if (Object.keys(stripped).length > 0) out.data = stripped;
  }

  // Detect unknown top-level keys (anything not in the accepted shape).
  const KNOWN_TOP = new Set(["title", "body", "url", "tag", "type", "category", "data"]);
  for (const k of Object.keys(input)) {
    if (!KNOWN_TOP.has(k)) report.droppedTopLevelKeys.push(k);
  }

  const hasAnyRedaction =
    report.removedKeys.length > 0 ||
    report.scrubbedStrings.length > 0 ||
    report.bodyForcedGeneric ||
    report.urlQueryDropped ||
    report.truncated.title ||
    report.truncated.body ||
    report.truncated.tag ||
    report.droppedTopLevelKeys.length > 0;

  if (auditLogger) {
    try {
      auditLogger({
        channel: opts?.channel,
        category,
        type,
        report,
        hasAnyRedaction,
      });
    } catch {
      // A broken logger must never break notification delivery.
    }
  }

  return { payload: out, report };
}



