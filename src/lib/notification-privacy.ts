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
  // Policy schimbată: notificările NU expun niciodată conținutul mesajului,
  // indiferent de preferința userului. Parametrii rămân în semnătură pentru
  // compatibilitate cu apelanții existenți, dar sunt ignorați.
  return GENERIC_MESSAGE_BODY;
}

/**
 * Preview-ul afișat în lista de conversații. Ignoră `showPreview` din
 * același motiv de confidențialitate.
 */
export function buildInboxPreview(
  _showPreview: boolean,
  _lastMessagePreview: string | null | undefined,
  hasAnyMessage: boolean,
): string {
  return hasAnyMessage ? GENERIC_MESSAGE_BODY : GENERIC_INBOX_FALLBACK;
}

