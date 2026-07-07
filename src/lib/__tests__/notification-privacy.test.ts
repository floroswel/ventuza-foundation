import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildInboxPreview,
  buildMessageNotificationBody,
  sanitizeNotificationPayload,
  GENERIC_INBOX_FALLBACK,
  GENERIC_MESSAGE_BODY,
} from "@/lib/notification-privacy";


const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("buildMessageNotificationBody — push payload", () => {
  const secrets = [
    "Salut, ne vedem la 20?",
    "📷 Photo",
    "🎤 Voice message",
    "📍 Locație partajată",
    "https://cdn.example.com/media/abcd.jpg",
    "caption: nudes incoming",
    "IBAN RO49AAAA1B31007593840000",
  ];

  it("întoarce mereu textul generic, indiferent de show_preview sau conținut", () => {
    for (const s of secrets) {
      expect(buildMessageNotificationBody(false, s)).toBe(GENERIC_MESSAGE_BODY);
      expect(buildMessageNotificationBody(true, s)).toBe(GENERIC_MESSAGE_BODY);
    }
  });

  it("nu scurge tipul media sau URL-ul chiar dacă preview-ul le conține", () => {
    const body = buildMessageNotificationBody(true, "📷 Photo https://cdn/x.jpg");
    expect(body).toBe(GENERIC_MESSAGE_BODY);
    expect(body).not.toMatch(/photo|voice|http|cdn|📷|🎤|📍/i);
  });

  it("null / undefined / empty → generic", () => {
    expect(buildMessageNotificationBody(false, null)).toBe(GENERIC_MESSAGE_BODY);
    expect(buildMessageNotificationBody(true, "")).toBe(GENERIC_MESSAGE_BODY);
  });
});

describe("buildInboxPreview — listă conversații", () => {
  it("are mesaje → generic, indiferent de show_preview sau preview-ul real", () => {
    expect(buildInboxPreview(false, "📷 Photo caption", true)).toBe(GENERIC_MESSAGE_BODY);
    expect(buildInboxPreview(true, "salut", true)).toBe(GENERIC_MESSAGE_BODY);
  });

  it("fără mesaje → fallback neutru", () => {
    expect(buildInboxPreview(false, null, false)).toBe(GENERIC_INBOX_FALLBACK);
    expect(buildInboxPreview(true, "salut", false)).toBe(GENERIC_INBOX_FALLBACK);
  });
});


describe("Invariante de sursă — nicio suprafață nu scurge conținut", () => {
  it("chat.ts folosește buildMessageNotificationBody, nu string literal", () => {
    const src = read("lib/chat.ts");
    expect(src).toContain("buildMessageNotificationBody");
    // Nu ar trebui să apară strings hardcodate cu conținut de mesaj în payload push
    expect(src).not.toMatch(/body:\s*preview\b/);
    expect(src).not.toMatch(/body:\s*payload\.body/);
  });

  it("notifications-context nu suprascrie n.body cu conținutul din payload realtime", () => {
    const src = read("lib/notifications-context.tsx");
    // Foloseste doar n.body (deja filtrat de trigger)
    expect(src).toMatch(/description:\s*n\.body/);
    // Nu concatenează media_type / caption / body raw din messages în toast
    expect(src).not.toMatch(/media_type|media_url|caption/);
  });

  it("messages.index.tsx nu afișează last_message_preview când show_preview=false", () => {
    const src = read("routes/messages.index.tsx");
    expect(src).toContain("showPreview");
    expect(src).toContain("Ai un mesaj nou");
    // Preview-ul apare doar sub gate showPreview
    const previewUses = [...src.matchAll(/last_message_preview/g)];
    expect(previewUses.length).toBeGreaterThan(0);
    // toate ocurentele trebuie într-un context care conține showPreview
    // (verificare simplă: în același fragment JSX de 400 caractere)
    for (const m of previewUses) {
      const window = src.slice(Math.max(0, m.index! - 200), m.index! + 200);
      expect(window).toMatch(/showPreview|SafeColumns|type\s|interface\s/i);
    }
  });
});
