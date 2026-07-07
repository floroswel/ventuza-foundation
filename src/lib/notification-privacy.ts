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
 * Copy pentru toast in-app. Când `show_preview` este OFF explicit,
 * afișează „Previzualizare dezactivată"; altfel folosește body-ul deja
 * sanitizat de trigger-ul DB (care e tot generic pentru categoria messages).
 */
export function buildToastBody(
  showPreview: boolean | null | undefined,
  dbBody: string | null | undefined,
): string {
  if (showPreview === false) return PREVIEW_DISABLED_BODY;
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

const PII_PATTERNS: Array<[RegExp, string]> = [
  // email
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  // telefon E.164 sau internațional
  [/\+?\d[\d\s().-]{7,}\d/g, "[phone]"],
  // IBAN (RO + generic)
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[iban]"],
  // CNP RO (13 cifre)
  [/\b[1-9]\d{12}\b/g, "[cnp]"],
  // coordonate lat,lng
  [/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g, "[coords]"],
];

function isForbiddenKey(key: string): boolean {
  if (ALLOWED_KEYS.has(key)) return false;
  return FORBIDDEN_KEY_PATTERNS.some((rx) => rx.test(key));
}

function scrubString(s: string): string {
  let out = s;
  for (const [rx, repl] of PII_PATTERNS) out = out.replace(rx, repl);
  return out;
}

function deepStrip(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(deepStrip);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenKey(k)) continue; // ELIMINĂ complet
      out[k] = deepStrip(v);
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
 * Sanitizează un payload de notificare. Trebuie apelat de FIECARE canal
 * (web push, FCM, native, in-app, email) înainte de trimitere.
 *
 * - `title` și `body` sunt limitate la max 120/140 caractere, scrubbed de PII;
 *   dacă categoria e `messages`, `body` este forțat la `GENERIC_MESSAGE_BODY`.
 * - Orice cheie sensibilă din payload sau `data` este eliminată (nu doar
 *   mascată). Stringurile rămase sunt scanate pentru PII.
 * - Câmpurile necunoscute la nivel top se ignoră (nu se propagă mai departe).
 */
export function sanitizeNotificationPayload(
  input: NotificationPayloadIn,
): SanitizedNotificationPayload {
  const category = typeof input.category === "string" ? input.category : undefined;
  const type = typeof input.type === "string" ? input.type : undefined;
  const isMessage =
    (category ?? "").toLowerCase() === "messages" ||
    (type ?? "").toLowerCase().includes("message");

  const rawTitle = (input.title ?? "").toString().trim() || "Ventuza";
  const rawBody = (input.body ?? "").toString().trim() || GENERIC_MESSAGE_BODY;

  const title = scrubString(rawTitle).slice(0, 120);
  const body = isMessage
    ? GENERIC_MESSAGE_BODY
    : scrubString(rawBody).slice(0, MAX_PREVIEW_LEN);

  const out: SanitizedNotificationPayload = { title, body };
  if (typeof input.url === "string" && input.url) {
    // păstrăm doar path-ul, fără query care poate conține tokens/PII
    try {
      const u = new URL(input.url, "https://placeholder.local");
      out.url = u.pathname;
    } catch {
      out.url = input.url.split("?")[0].slice(0, 300);
    }
  }
  if (typeof input.tag === "string" && input.tag) out.tag = input.tag.slice(0, 80);
  if (type) out.type = type.slice(0, 40);
  if (category) out.category = category.slice(0, 40);
  if (input.data && typeof input.data === "object") {
    const stripped = deepStrip(input.data) as Record<string, unknown>;
    if (Object.keys(stripped).length > 0) out.data = stripped;
  }
  return out;
}


