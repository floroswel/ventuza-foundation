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
  showPreview: boolean,
  preview: string | null | undefined,
): string {
  if (!showPreview) return GENERIC_MESSAGE_BODY;
  const trimmed = (preview ?? "").trim();
  if (!trimmed) return GENERIC_MESSAGE_BODY;
  return trimmed.slice(0, MAX_PREVIEW_LEN);
}

/**
 * Preview-ul afișat în lista de conversații.
 */
export function buildInboxPreview(
  showPreview: boolean,
  lastMessagePreview: string | null | undefined,
  hasAnyMessage: boolean,
): string {
  if (showPreview) {
    const trimmed = (lastMessagePreview ?? "").trim();
    return trimmed.length > 0 ? trimmed : GENERIC_INBOX_FALLBACK;
  }
  return hasAnyMessage ? GENERIC_MESSAGE_BODY : GENERIC_INBOX_FALLBACK;
}
