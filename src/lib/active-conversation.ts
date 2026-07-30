/**
 * Conversația deschisă în acest moment (rută `/messages/:id`).
 *
 * Folosită ca să NU mai afișăm toast de „mesaj nou" când userul este deja în
 * discuția respectivă — acolo mesajul apare oricum în thread; rămâne doar
 * sunetul. Nu stochează conținut, doar ID-ul conversației.
 */
let activeConversationId: string | null = null;

export function setActiveConversation(id: string | null) {
  activeConversationId = id;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

export function isViewingConversation(id: string | null | undefined): boolean {
  return !!id && activeConversationId === id;
}

/** Extrage id-ul conversației dintr-un link de notificare (`/messages/<id>`). */
export function conversationIdFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const m = /^\/messages\/([0-9a-fA-F-]{16,})/.exec(link);
  return m ? m[1] : null;
}
