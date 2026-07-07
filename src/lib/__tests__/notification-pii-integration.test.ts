/**
 * Integration test: notifier payload MUST NEVER include phone numbers or
 * email addresses, even if they appear in the original message text.
 *
 * Simulates the full pipeline a message body takes before reaching a push
 * channel:
 *   1. `buildMessageNotificationBody(showPreview, originalMessageText)`
 *      → returns the string put into the `body` field of the push payload.
 *   2. `sanitizeNotificationPayload({ title, body, category, data })`
 *      → runs the final scrubber every channel (web push, FCM, in-app toast,
 *        email) applies before sending.
 *
 * If either layer regresses (e.g. someone flips `buildMessageNotificationBody`
 * to return the raw preview under `show_preview=true`, or drops the category
 * check inside the sanitizer), an email or phone from a user's DM would leak
 * to the OS notification center. These tests fail closed for that scenario.
 */

import { describe, it, expect } from "vitest";
import {
  buildMessageNotificationBody,
  buildToastBody,
  buildInboxPreview,
  sanitizeNotificationPayload,
  GENERIC_MESSAGE_BODY,
} from "@/lib/notification-privacy";

// A representative set of message texts a real user might send. Each contains
// at least one email and/or phone number in various formats.
const MESSAGES_WITH_PII: string[] = [
  "Salut! Scrie-mi pe andrei.popescu@example.com",
  "Sună-mă la +40 712 345 678, ne vedem diseară",
  "0722 123 456 sau (0040)-721-999-000",
  "Contact: user+tag@sub.example.co.uk / tel: +1-415-555-0132",
  "Datele mele: john.doe@company.io, +447911123456, IBAN RO49AAAA1B31007593840000",
  "Hai la 20:30 la mine, sms 0723456789",
  "email meu vechi: OLD_email-1999@yahoo.co.uk, sms +33 6 12 34 56 78",
  "📷 caption cu email leaked@leak.com și tel +40712000111",
];

// Regexes used ONLY to assert the output is clean. Intentionally broader than
// the sanitizer's own patterns so we catch partial leaks (e.g. digits smuggled
// through as "40 712 345 678" without the leading +).
const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_LIKE = /(\+?\d[\d\s().-]{6,}\d)/;

/** Assert a rendered string contains no email or phone-like sequence. */
function expectNoPii(rendered: string, source: string): void {
  expect(rendered, `email leaked from: ${source}`).not.toMatch(EMAIL_LIKE);
  expect(rendered, `phone leaked from: ${source}`).not.toMatch(PHONE_LIKE);
}

describe("integration: notifier payload never contains phone/email from message text", () => {
  it("push body: buildMessageNotificationBody strips phone+email regardless of show_preview", () => {
    for (const msg of MESSAGES_WITH_PII) {
      const bodyPreviewOff = buildMessageNotificationBody(false, msg);
      const bodyPreviewOn = buildMessageNotificationBody(true, msg);
      expect(bodyPreviewOff).toBe(GENERIC_MESSAGE_BODY);
      expect(bodyPreviewOn).toBe(GENERIC_MESSAGE_BODY);
      expectNoPii(bodyPreviewOff, msg);
      expectNoPii(bodyPreviewOn, msg);
    }
  });

  it("inbox preview: buildInboxPreview never echoes phone/email from last message", () => {
    for (const msg of MESSAGES_WITH_PII) {
      expectNoPii(buildInboxPreview(true, msg, true), msg);
      expectNoPii(buildInboxPreview(false, msg, true), msg);
      expectNoPii(buildInboxPreview(undefined, msg, true), msg);
    }
  });

  it("toast body: buildToastBody never echoes phone/email for type=message", () => {
    for (const msg of MESSAGES_WITH_PII) {
      expectNoPii(buildToastBody(true, msg, "message"), msg);
      expectNoPii(buildToastBody(false, msg, "message"), msg);
      expectNoPii(buildToastBody(null, msg, "message"), msg);
    }
  });

  it("full pipeline: sanitizeNotificationPayload cleans body/title even if a caller passes raw msg text", () => {
    for (const msg of MESSAGES_WITH_PII) {
      // Simulate a defective caller that forwards the raw message text.
      const out = sanitizeNotificationPayload({
        title: `De la: ${msg}`,
        body: buildMessageNotificationBody(true, msg),
        category: "messages",
        type: "new_message",
      });
      // Category=messages forces generic body regardless of input.
      expect(out.body).toBe(GENERIC_MESSAGE_BODY);
      expectNoPii(out.body, msg);
      expectNoPii(out.title, msg);
    }
  });

  it("full pipeline: even when body is forcibly set to the raw message, sanitizer scrubs PII", () => {
    // Non-messages category: body is not forced to generic, but PII patterns
    // must still be masked by the scrubber.
    for (const msg of MESSAGES_WITH_PII) {
      const out = sanitizeNotificationPayload({
        title: msg,
        body: msg,
        category: "marketing", // worst-case: category doesn't trigger generic override
      });
      expectNoPii(out.title, msg);
      expectNoPii(out.body, msg);
    }
  });

  it("data payload: phone/email nested at any depth are removed from the notifier data", () => {
    for (const msg of MESSAGES_WITH_PII) {
      const out = sanitizeNotificationPayload({
        title: "t",
        body: "b",
        category: "messages",
        data: {
          conversation_id: "conv-1",
          // Malicious/buggy caller trying to smuggle the original text through
          // an innocent-looking key inside `data`.
          preview: msg,
          snippet: msg,
          message: msg,
          nested: {
            reply_to: msg,
            note: `contact ${msg}`,
            phone: "+40712345678",
            email: "leak@x.io",
          },
        },
      });
      // The safe key survives.
      expect(out.data?.conversation_id).toBe("conv-1");

      // Forbidden keys are stripped entirely (not just masked).
      const flat = JSON.stringify(out.data ?? {});
      expect(flat).not.toMatch(/preview|snippet|"message"|reply_to|"phone"|"email"/);

      // No PII string survives anywhere in the serialized data.
      expectNoPii(flat, msg);
    }
  });

  it("data payload: strings that survive (allowed keys) are still PII-scrubbed", () => {
    // `title` is on the ALLOWED_KEYS list at the sanitizer level; ensure a
    // caller who leaks the message text through an allowed slot still gets it
    // scrubbed by the string-level PII pass.
    const msg = "sună-mă la +40 722 123 456 sau scrie la me@example.com";
    const out = sanitizeNotificationPayload({
      title: msg,
      body: "Ai un mesaj nou",
      category: "marketing",
      data: { conversation_id: msg }, // conversation_id is allowed
    });
    expectNoPii(out.title, msg);
    expectNoPii(String(out.data?.conversation_id ?? ""), msg);
  });
});
