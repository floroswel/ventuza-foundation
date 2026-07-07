/**
 * Integration test — push payload allowlist enforcement.
 *
 * Contract under test: every payload that leaves the server (web-push / FCM /
 * native) MUST contain, inside `data`, ONLY the keys explicitly allowlisted
 * for its notification category. There is NO escape hatch labelled
 * `raw_data`, `extra`, `meta`, `passthrough`, `payload`, `debug`, or similar.
 *
 * The suite drives the same helper the real push dispatcher uses
 * (`sanitizeNotificationPayload`, see `src/lib/push.functions.ts` L249) with
 * hostile inputs and asserts:
 *   1. `data` is a subset of the category allowlist.
 *   2. Any hostile / raw-data key is dropped (and reported in
 *      `notAllowlistedKeys` or `removedKeys`).
 *   3. `title` / `body` never propagate raw content for `messages`
 *      (forced to `GENERIC_MESSAGE_BODY`).
 *   4. No PII pattern (email, phone, IBAN, CNP, coords) survives anywhere
 *      in the serialized outbound payload.
 *   5. Legacy escape hatch `strict:false` is refused as a means to smuggle
 *      raw keys — we assert we NEVER call it from real dispatch code.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  sanitizeNotificationPayload,
  sanitizeNotificationPayloadWithReport,
  getNotificationCategoryAllowlists,
  GENERIC_MESSAGE_BODY,
} from "@/lib/notification-privacy";

const HOSTILE_DATA: Record<string, unknown> = {
  // Content leaks
  preview: "Salut, ne vedem la 20?",
  snippet: "IBAN RO49AAAA1B31007593840000",
  message: "hidden text",
  body: "hidden text 2",
  text: "hidden text 3",
  caption: "nudes incoming",
  media_url: "https://cdn.example.com/x.jpg",
  media_type: "photo",
  voice_url: "https://cdn.example.com/x.ogg",
  transcript: "voice text",
  // Sensitive Art. 9
  hiv_status: "positive",
  hiv_test_date_enc: "xxx",
  orientation: "gay",
  gender: "male",
  tribes: ["bear"],
  // Location
  lat: 44.4,
  lng: 26.1,
  location: { lat: 1, lng: 2 },
  distance_m: 123,
  // Direct identifiers
  email: "user@example.com",
  phone: "+40712345678",
  phone_e164: "+40712345678",
  iban: "RO49AAAA1B31007593840000",
  cnp: "1900101223344",
  // Credentials / device
  auth: "secret",
  p256dh: "secret",
  endpoint: "https://fcm/x",
  access_token: "aaa",
  refresh_token: "bbb",
  api_key: "kkk",
  fingerprint: "fp",
  ip: "1.2.3.4",
  user_agent: "UA",
  // "Escape hatch" names an unfortunate dev might try
  raw_data: { anything: "goes" },
  extra: { anything: "goes" },
  meta: { anything: "goes" },
  passthrough: { anything: "goes" },
  payload: { anything: "goes" },
  debug: "trace",
  // Random junk
  arbitrary_flag: true,
  attacker_controlled: "🤨",
};

const KNOWN_CATEGORIES = [
  "messages",
  "match",
  "tap",
  "woof",
  "album",
  "proximity",
  "admin_message",
  "partner_status",
  "system",
] as const;

const PII_REGEXES: Array<[string, RegExp]> = [
  ["email", /[\w.+-]+@[\w-]+\.[\w.-]+/],
  ["phone", /\+?\d[\d\s().-]{7,}\d/],
  ["iban", /\bRO\d{2}[A-Z0-9]{10,30}\b/],
  ["cnp", /\b[1-9]\d{12}\b/],
  ["coords", /-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/],
  ["cdn-url", /https?:\/\/cdn\./],
];

function buildLegitData(category: string): Record<string, unknown> {
  const allow = getNotificationCategoryAllowlists()[category] ?? [];
  const out: Record<string, unknown> = {};
  for (const k of allow) out[k] = `legit-${k}`;
  return out;
}

describe("push payload allowlist — integration per category", () => {
  it.each(KNOWN_CATEGORIES)(
    "%s: outbound data contains ONLY allowlisted keys, hostile keys dropped",
    (category) => {
      const legit = buildLegitData(category);
      const input = {
        title: "Andrei",
        body: "Salut, ne vedem la 20? tel +40712345678",
        url: "/messages/123?token=SECRET",
        tag: `notif:${category}`,
        type: category,
        category,
        data: { ...legit, ...HOSTILE_DATA },
      };
      const { payload, report } = sanitizeNotificationPayloadWithReport(input);

      const allow = getNotificationCategoryAllowlists()[category] ?? [];
      const allowSet = new Set(allow);

      // 1. Every surviving key is on the allowlist.
      const surviving = Object.keys(payload.data ?? {});
      for (const k of surviving) {
        expect(
          allowSet.has(k),
          `category=${category} leaked key "${k}" not in allowlist [${allow.join(", ")}]`,
        ).toBe(true);
      }
      // 2. Every legit key survived intact.
      for (const k of allow) {
        expect(payload.data?.[k]).toBe(`legit-${k}`);
      }
      // 3. Report attributes the drop to allowlist or denylist for each hostile key.
      for (const k of Object.keys(HOSTILE_DATA)) {
        if (allowSet.has(k)) continue; // (none of ours collide, but be safe)
        const path = `/data/${k}`;
        const dropped =
          report.removedKeys.includes(path) ||
          report.notAllowlistedKeys.includes(path);
        expect(
          dropped,
          `category=${category} hostile key ${path} must appear in a report bucket`,
        ).toBe(true);
      }
      expect(report.allowlistApplied).toBe(category);

      // 4. Serialized full payload contains NO PII pattern (title/body/url/data).
      const serialized = JSON.stringify(payload);
      for (const [name, rx] of PII_REGEXES) {
        expect(
          rx.test(serialized),
          `category=${category} serialized push payload leaked ${name}: ${serialized}`,
        ).toBe(false);
      }
      // 5. URL query stripped.
      expect(payload.url ?? "").not.toContain("token=");
      // 6. Message category: body forced to generic copy.
      if (category === "messages") {
        expect(payload.body).toBe(GENERIC_MESSAGE_BODY);
      }
    },
  );

  it("refuses to keep ANY 'raw_data'-shaped escape hatch, even when nested at top", () => {
    // An attacker (or careless dev) may try to pass hostile content wrapped in
    // an innocent-looking envelope. Neither the wrapper nor its contents can
    // survive: the wrapper key itself is not on any allowlist.
    for (const wrapper of ["raw_data", "extra", "meta", "payload", "debug", "passthrough"]) {
      const { payload } = sanitizeNotificationPayloadWithReport({
        title: "T",
        body: "B",
        category: "match",
        data: {
          match_id: "m1",
          [wrapper]: { hiv_status: "positive", email: "x@y.com" },
        },
      });
      expect(payload.data?.[wrapper]).toBeUndefined();
      expect(payload.data).toEqual({ match_id: "m1" });
    }
  });

  it("unknown category with strict:true drops the entire `data` object", () => {
    const { payload, report } = sanitizeNotificationPayloadWithReport(
      {
        title: "T",
        body: "B",
        category: "totally_new_channel",
        data: { anything: 1, whatever: 2 },
      },
      { strict: true },
    );
    expect(payload.data).toBeUndefined();
    expect(report.allowlistApplied).toBe("__strict_empty__");
  });

  it("the outbound `push_subscriptions`-shaped push payload (title/body/url/tag/type) is minimal", () => {
    // Mirrors the exact shape assembled in `src/lib/push.functions.ts` L263-269.
    const safePayload = sanitizeNotificationPayload({
      title: "Andrei",
      body: "Salut, ne vedem la 20?",
      url: "/messages/abc?token=SECRET",
      tag: "notif:messages",
      type: "messages",
      category: "messages",
      data: {
        conversation_id: "c1",
        actor_id: "u1",
        sent_at: "now",
        // hostile:
        preview: "leak",
        media_url: "https://cdn/x.jpg",
      },
    });
    const outbound = {
      title: safePayload.title,
      body: safePayload.body,
      url: safePayload.url,
      tag: safePayload.tag,
      type: safePayload.type,
    };
    expect(Object.keys(outbound).sort()).toEqual(
      ["body", "tag", "title", "type", "url"].sort(),
    );
    expect(outbound.body).toBe(GENERIC_MESSAGE_BODY);
    expect(outbound.url).toBe("/messages/abc");
    // No content leakage anywhere.
    const s = JSON.stringify(outbound);
    expect(s).not.toMatch(/Salut/);
    expect(s).not.toMatch(/cdn/);
    expect(s).not.toMatch(/preview/i);
    expect(s).not.toMatch(/media_url/i);
  });
});

describe("dispatcher source invariants — no raw-data escape hatch in production code", () => {
  const SRC = join(process.cwd(), "src");
  const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

  it("push.functions.ts does not pass a `data` field to sanitizeNotificationPayload without going through the allowlist", () => {
    // The real dispatcher (L249) intentionally omits `data` from
    // `sanitizeNotificationPayload({...})` — routing IDs travel via
    // `tag` / `url`. Regression guard: no one adds a `data:` sibling that
    // would carry raw fields into the push payload.
    const src = read("lib/push.functions.ts");
    // Extract the sanitizeNotificationPayload({...}) block(s) and assert none
    // introduces a `data:` property assignment. We match a single-level block.
    const blocks = src.match(/sanitizeNotificationPayload\(\s*\{[\s\S]*?\}\s*\)/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      // Allow the word `data` in comments? No — comments were already stripped
      // by the extractor above only if they were inline; be strict here.
      expect(
        /\bdata\s*:/.test(block),
        `push.functions.ts sanitize block must not smuggle 'data:' — got:\n${block}`,
      ).toBe(false);
    }
  });

  it("no production module calls sanitizeNotificationPayload(..., { strict: false })", () => {
    // `strict:false` is the escape hatch — it MUST only appear in tests. We
    // scan every non-test *.ts/tsx under src/ (excluding notification-privacy.ts
    // itself, which documents the flag in its JSDoc) for an actual call site.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const out = execSync(
      "grep -RIn --include='*.ts' --include='*.tsx' " +
        "-E 'sanitizeNotificationPayload[^)]*strict:\\s*false' " +
        "src/lib src/routes || true",
      { encoding: "utf8" },
    );
    const offenders = out
      .split("\n")
      .filter(Boolean)
      .filter((line) => !line.includes("__tests__"))
      .filter((line) => !line.startsWith("src/lib/notification-privacy.ts:"));
    expect(
      offenders,
      `strict:false escape hatch found in production code:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
