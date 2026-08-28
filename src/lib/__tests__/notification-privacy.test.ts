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
  it("show_preview=false + are mesaje → copy explicit Previzualizare dezactivata", () => {
    expect(buildInboxPreview(false, "📷 Photo caption", true)).toBe("Previzualizare dezactivată");
  });

  it("show_preview=true/undefined + are mesaje → ultimul mesaj real", () => {
    expect(buildInboxPreview(true, "salut", true)).toBe("salut");
    expect(buildInboxPreview(undefined, "salut", true)).toBe("salut");
    expect(buildInboxPreview(true, "   ", true)).toBe(GENERIC_MESSAGE_BODY);
  });

  it("fără mesaje → fallback neutru, indiferent de show_preview", () => {
    expect(buildInboxPreview(false, null, false)).toBe(GENERIC_INBOX_FALLBACK);
    expect(buildInboxPreview(true, "salut", false)).toBe(GENERIC_INBOX_FALLBACK);
  });
});


describe("Invariante de sursă — nicio suprafață nu scurge conținut", () => {
  it("corpul push-ului de mesaj se construiește pe server, prin buildMessageNotificationBody", () => {
    // Garanția s-a mutat din client în server: `chat.ts` nu trimite nimic,
    // trigger-ul din baza de date compune corpul. Mai strict decât
    // înainte — textul mesajului nu mai părăsește deloc telefonul pentru push.
    // Corpul notificării de mesaj se scrie acum în SQL, în trigger, ca o
    // constantă generică — `buildMessageNotificationBody` întorcea oricum
    // mereu aceeași valoare, deci garanția e identică, doar mutată acolo unde
    // se ia decizia.
    const push = read("lib/push-dispatch.server.ts");
    expect(push).not.toMatch(/body:\s*preview\b/);
    expect(push).not.toMatch(/body:\s*payload\.body/);

    const src = read("lib/chat.ts");
    expect(src).not.toMatch(/body:\s*preview\b/);
    expect(src).not.toMatch(/body:\s*payload\.body/);
    // Clientul nu mai atinge deloc stratul de push pentru mesaje: notificarea
    // se programează în SQL (trigger `tg_notify_new_message`).
    expect(src).not.toMatch(/sendMessagePush/);

  });

  it("notifications-context trece toast body prin buildToastBody, nu n.body direct", () => {
    const src = read("lib/notifications-context.tsx");
    // Trece prin helper-ul central (fail-closed pentru type=message)
    expect(src).toMatch(/buildToastBody\s*\(/);
    // NU are voie să folosească n.body brut ca description
    expect(src).not.toMatch(/description:\s*n\.body/);
    // Nu concatenează media_type / caption / body raw din messages în toast
    expect(src).not.toMatch(/media_type|media_url|caption/);
  });

  it("messages.index.tsx randează prin buildInboxPreview (nu conținut brut)", () => {
    const src = read("routes/messages.index.tsx");
    expect(src).toContain("showPreview");
    expect(src).toContain("buildInboxPreview");
    // Preview-ul brut NU mai este referențiat direct în JSX
    expect(src).not.toMatch(/showPreview\s*\?\s*\(?c\.last_message_preview/);
  });
});


describe("sanitizeNotificationPayload — filtru central", () => {
  it("forțează body generic când categoria este 'messages'", () => {
    const out = sanitizeNotificationPayload({
      title: "Andrei",
      body: "Salut, ne vedem la 20? +40 712 345 678",
      category: "messages",
    });
    expect(out.body).toBe(GENERIC_MESSAGE_BODY);
    expect(out.title).toBe("Andrei");
  });

  it("mascheaza email/telefon/IBAN în title/body pentru alte categorii", () => {
    const out = sanitizeNotificationPayload({
      title: "Contact: user@example.com",
      body: "IBAN RO49AAAA1B31007593840000 tel +40712345678",
      category: "marketing",
    });
    expect(out.title).not.toContain("user@example.com");
    expect(out.body).not.toMatch(/RO49AAAA1B31007593840000/);
    expect(out.body).not.toMatch(/\+40712345678/);
  });

  it("elimină chei sensibile din data la orice adâncime", () => {
    const out = sanitizeNotificationPayload({
      title: "t",
      body: "b",
      data: {
        conversation_id: "abc",
        hiv_status: "positive",
        hiv_status_enc: "xxx",
        location: { lat: 44.4, lng: 26.1 },
        phone: "+40712345678",
        auth: "secret",
        endpoint: "https://fcm/x",
        nested: { message: "salut", body: "leak", ok: true, gender: "male" },
      },
    });
    const d = out.data!;
    expect(d.conversation_id).toBe("abc");
    expect("hiv_status" in d).toBe(false);
    expect("hiv_status_enc" in d).toBe(false);
    expect("location" in d).toBe(false);
    expect("phone" in d).toBe(false);
    expect("auth" in d).toBe(false);
    expect("endpoint" in d).toBe(false);
    const nested = d.nested as Record<string, unknown>;
    expect("message" in nested).toBe(false);
    expect("body" in nested).toBe(false);
    expect("gender" in nested).toBe(false);
    expect(nested.ok).toBe(true);
  });

  it("elimină query-ul din url (poate conține tokens)", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      url: "/messages/123?token=SECRET&code=42",
    });
    expect(out.url).toBe("/messages/123");
  });
});
