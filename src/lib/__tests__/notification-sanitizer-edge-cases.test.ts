/**
 * Edge-case tests for `sanitizeNotificationPayload`.
 *
 * Covers structural shapes the runtime scrubber must handle safely:
 *   - deeply nested objects (forbidden keys at depth > 1)
 *   - arrays of mixed primitive + object types
 *   - arrays containing objects with forbidden keys
 *   - unexpected top-level and nested field names (casing, typos, prefixes)
 *   - primitive edge cases (null, undefined, numbers, booleans, empty strings)
 *   - PII smuggled inside allowed keys (title, tag, url path)
 *   - malformed / very long strings
 *   - circular-ish input (self-similar deep tree)
 *
 * Regula: nicio scurgere de conținut de mesaj, PII (email/telefon/IBAN/CNP),
 * locație precisă, date Art. 9, tokens/credențiale — indiferent unde sunt
 * poziționate în payload.
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeNotificationPayload,
  GENERIC_MESSAGE_BODY,
} from "@/lib/notification-privacy";

const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_LIKE = /\+?\d[\d\s().-]{6,}\d/;
const IBAN_LIKE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,}\b/;
const CNP_LIKE = /\b[1-9]\d{12}\b/;

function assertNoPii(serialized: string, label: string) {
  expect(serialized, `email leak: ${label}`).not.toMatch(EMAIL_LIKE);
  expect(serialized, `phone leak: ${label}`).not.toMatch(PHONE_LIKE);
  expect(serialized, `iban leak: ${label}`).not.toMatch(IBAN_LIKE);
  expect(serialized, `cnp leak:   ${label}`).not.toMatch(CNP_LIKE);
}

describe("sanitizer edge cases — nested objects", () => {
  it("strips forbidden keys at depth 4+", () => {
    const out = sanitizeNotificationPayload({
      title: "t",
      body: "b",
      data: {
        a: { b: { c: { d: { hiv_status: "positive", ok: 1 } } } },
      },
    });
    const flat = JSON.stringify(out.data);
    expect(flat).not.toMatch(/hiv_status|positive/);
    expect(flat).toMatch(/"ok":1/);
  });

  it("strips multiple forbidden keys mixed with safe ones at same level", () => {
    const out = sanitizeNotificationPayload({
      title: "t",
      body: "b",
      data: {
        conversation_id: "c1",
        message: "leak",
        location: { lat: 44.1, lng: 26.1 },
        actor_id: "u1",
        media_url: "https://x/y.jpg",
        gender: "male",
      },
    });
    expect(out.data?.conversation_id).toBe("c1");
    expect(out.data?.actor_id).toBe("u1");
    expect("message" in (out.data ?? {})).toBe(false);
    expect("location" in (out.data ?? {})).toBe(false);
    expect("media_url" in (out.data ?? {})).toBe(false);
    expect("gender" in (out.data ?? {})).toBe(false);
  });

  it("handles self-similar deep tree without stack overflow", () => {
    // 50 levels of nesting; each level carries both a safe and a forbidden key.
    let node: Record<string, unknown> = { hiv_status: "leaf", id: "leaf" };
    for (let i = 0; i < 50; i++) {
      node = { child: node, phone: "+40712000000", tag: `t${i}` };
    }
    const out = sanitizeNotificationPayload({ title: "t", body: "b", data: node });
    const flat = JSON.stringify(out.data);
    expect(flat).not.toMatch(/hiv_status|phone|\+40712000000/);
  });
});

describe("sanitizer edge cases — arrays of mixed types", () => {
  it("scrubs strings inside a primitive array", () => {
    const out = sanitizeNotificationPayload({
      title: "t",
      body: "b",
      data: {
        items: [
          "safe",
          "email me@x.io",
          "+40 712 345 678",
          42,
          true,
          null,
          "IBAN RO49AAAA1B31007593840000",
        ],
      },
    });
    const items = out.data?.items as unknown[];
    expect(items).toHaveLength(7);
    expect(items[0]).toBe("safe");
    expect(items[3]).toBe(42);
    expect(items[4]).toBe(true);
    expect(items[5]).toBe(null);
    assertNoPii(JSON.stringify(items), "primitive array");
  });

  it("strips forbidden keys inside array elements (array of objects)", () => {
    const out = sanitizeNotificationPayload({
      title: "t",
      body: "b",
      data: {
        matches: [
          { id: "m1", body: "leak text", hiv_status: "positive" },
          { id: "m2", location: { lat: 1, lng: 2 }, ok: true },
          { id: "m3", phone: "+40712000111", email: "leak@x.io" },
        ],
      },
    });
    const matches = out.data?.matches as Array<Record<string, unknown>>;
    expect(matches).toHaveLength(3);
    matches.forEach((m, i) => {
      expect(m.id).toBe(`m${i + 1}`);
      expect("body" in m).toBe(false);
      expect("hiv_status" in m).toBe(false);
      expect("location" in m).toBe(false);
      expect("phone" in m).toBe(false);
      expect("email" in m).toBe(false);
    });
    expect(matches[1].ok).toBe(true);
    assertNoPii(JSON.stringify(matches), "array of objects");
  });

  it("handles nested arrays (array of arrays of objects)", () => {
    const out = sanitizeNotificationPayload({
      title: "t",
      body: "b",
      data: {
        grid: [
          [{ id: 1, message: "x" }, { id: 2, gender: "male" }],
          [{ id: 3, location: {} }, "loose@email.com"],
        ],
      },
    });
    const flat = JSON.stringify(out.data);
    expect(flat).not.toMatch(/"message"|"gender"|"location"/);
    assertNoPii(flat, "nested arrays");
  });

  it("empty arrays and empty objects survive as-is", () => {
    const out = sanitizeNotificationPayload({
      title: "t",
      body: "b",
      data: { emptyArr: [], emptyObj: {}, id: "x" },
    });
    expect(out.data?.emptyArr).toEqual([]);
    expect(out.data?.emptyObj).toEqual({});
    expect(out.data?.id).toBe("x");
  });
});

describe("sanitizer edge cases — unexpected / adversarial field names", () => {
  it("strips forbidden keys regardless of case", () => {
    const out = sanitizeNotificationPayload({
      title: "t",
      body: "b",
      data: {
        BODY: "leak", Message: "leak", HIV_STATUS: "positive",
        Location: {}, PHONE: "x", Email: "x", Media_Url: "x",
      },
    });
    const keys = Object.keys(out.data ?? {});
    expect(keys).toHaveLength(0);
  });

  it("strips keys that only partially match a forbidden pattern (media_*)", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      data: {
        media_type: "image",
        media_url_v2: "x",
        preview_media_kind: "voice",
        my_media_url_override: "x",
        id: "keep",
      },
    });
    expect(out.data?.id).toBe("keep");
    expect(Object.keys(out.data ?? {})).toEqual(["id"]);
  });

  it("strips typo-adjacent forbidden keys (`snippet`, `last_message_x`, `reply_to`)", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      data: {
        snippet: "leak", reply_to: "leak", last_message_preview: "leak",
        last_message_body: "leak", quoted: "leak", translation: "leak",
        transcript: "leak", ok: 1,
      },
    });
    expect(out.data).toEqual({ ok: 1 });
  });

  it("strips *_enc suffix regardless of prefix", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      data: { foo_enc: "x", bar_baz_enc: "x", enc: "keep-plain", id: "y" },
    });
    // `enc` alone (no `_enc` suffix pattern) is not forbidden; only *_enc keys.
    expect(out.data?.enc).toBe("keep-plain");
    expect(out.data?.id).toBe("y");
    expect("foo_enc" in (out.data ?? {})).toBe(false);
    expect("bar_baz_enc" in (out.data ?? {})).toBe(false);
  });

  it("keeps benign top-level fields but drops unknown top-level keys", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      url: "/x", tag: "y", type: "match", category: "matches",
      // unknown top-level:
      random_top_level: "leak",
      // safe data:
      data: { id: "z" },
    } as unknown as Parameters<typeof sanitizeNotificationPayload>[0]);
    expect(out).toMatchObject({ title: "t", url: "/x", tag: "y", type: "match", category: "matches" });
    expect("random_top_level" in out).toBe(false);
    expect(out.data?.id).toBe("z");
  });
});

describe("sanitizer edge cases — PII smuggled via allowed keys / strings", () => {
  it("scrubs PII from `title` even when key is allowed", () => {
    const out = sanitizeNotificationPayload({
      title: "Nou de la user@example.com și +40712345678",
      body: "b",
      category: "marketing",
    });
    assertNoPii(out.title, "title allowed key");
  });

  it("drops query string from url (may contain token/PII) and keeps only path", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      url: "https://ventuza.app/m/42?email=leak@x.io&phone=%2B40712000000&token=SECRET",
    });
    expect(out.url).toBe("/m/42");
    assertNoPii(out.url ?? "", "url");
  });

  it("clamps very long title/body without leaving PII in the tail", () => {
    const bigBody = "x".repeat(500) + " tel +40 712 345 678 " + "y".repeat(500);
    const out = sanitizeNotificationPayload({
      title: "t", body: bigBody, category: "marketing",
    });
    expect(out.body.length).toBeLessThanOrEqual(140);
    assertNoPii(out.body, "clamped body");
  });

  it("scrubs PII inside strings kept via allowed data keys (conversation_id, tag)", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      tag: "convo user@leak.com +40712000111",
      data: { conversation_id: "id-user@leak.com-+40712000111" },
    });
    assertNoPii(out.tag ?? "", "tag");
    assertNoPii(String(out.data?.conversation_id ?? ""), "conversation_id");
  });
});

describe("sanitizer edge cases — primitives, invariants", () => {
  it("null/undefined body → generic fallback, no crash", () => {
    const out = sanitizeNotificationPayload({ title: null, body: null });
    expect(out.title).toBe("Ventuza");
    expect(out.body).toBe(GENERIC_MESSAGE_BODY);
  });

  it("category=messages forces generic body regardless of raw body", () => {
    const out = sanitizeNotificationPayload({
      title: "Andrei",
      body: "leak@x.io +40712345678 IBAN RO49AAAA1B31007593840000",
      category: "messages",
    });
    expect(out.body).toBe(GENERIC_MESSAGE_BODY);
    assertNoPii(out.body, "messages category");
  });

  it("data omitted entirely when result is empty", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      data: { message: "only-leaks", hiv_status: "x", auth: "y" },
    });
    expect(out.data).toBeUndefined();
  });

  it("numbers / booleans / null preserved verbatim under safe keys", () => {
    const out = sanitizeNotificationPayload({
      title: "t", body: "b",
      data: { id: 0, priority: 1, sent_at: null, category: "match" },
    });
    expect(out.data).toEqual({ id: 0, priority: 1, sent_at: null, category: "match" });
  });

  it("idempotent — sanitizing an already-sanitized payload does not regress it", () => {
    const first = sanitizeNotificationPayload({
      title: "Andrei",
      body: "leak@x.io",
      category: "messages",
      data: { conversation_id: "c1", message: "x" },
    });
    const second = sanitizeNotificationPayload({
      title: first.title,
      body: first.body,
      category: first.category,
      data: first.data,
    });
    expect(second).toEqual(first);
  });
});
