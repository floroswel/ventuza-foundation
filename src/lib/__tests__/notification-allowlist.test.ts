/**
 * Strict allowlist mode: for each known notification category, ONLY the
 * approved keys survive into the outgoing `data` object. Anything else is
 * dropped and recorded structurally in the redaction report.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeNotificationPayload,
  sanitizeNotificationPayloadWithReport,
  registerNotificationCategoryAllowlist,
  getNotificationCategoryAllowlists,
} from "@/lib/notification-privacy";

describe("strict allowlist — known categories", () => {
  it("messages: only conversation_id/actor_id/sent_at survive", () => {
    const { payload, report } = sanitizeNotificationPayloadWithReport({
      title: "Andrei",
      body: "text ostil care se pierde oricum",
      category: "messages",
      data: {
        conversation_id: "c1",
        actor_id: "u1",
        sent_at: "ts-abc",
        // Extra keys that must be dropped by the allowlist:
        room_name: "secret-room",
        thread_topic: "cancer treatment",
        // Denylist-forbidden keys (double coverage):
        preview: "leak",
        email: "x@y.com",
      },
    });
    expect(payload.data).toEqual({
      conversation_id: "c1",
      actor_id: "u1",
      sent_at: "ts-abc",
    });
    expect(report.allowlistApplied).toBe("messages");
    expect(report.notAllowlistedKeys).toEqual(
      expect.arrayContaining(["/data/room_name", "/data/thread_topic"]),
    );
    expect(report.removedKeys).toEqual(
      expect.arrayContaining(["/data/preview", "/data/email"]),
    );
  });

  it.each([
    ["match", ["match_id", "actor_id", "created_at"]],
    ["tap", ["actor_id", "created_at"]],
    ["woof", ["actor_id", "created_at"]],
    ["album", ["album_id", "actor_id", "created_at"]],
    ["proximity", ["point_id", "point_kind", "distance_bucket", "layer"]],
    ["admin_message", ["message_id", "priority", "created_at"]],
    ["partner_status", ["item_id", "item_kind", "status", "created_at"]],
    ["system", ["subject", "created_at"]],
  ])("%s allowlist keeps only its approved keys", (category, allowed) => {
    const data: Record<string, unknown> = { hostile_extra: "leak" };
    for (const k of allowed) data[k] = `v-${k}`;
    const { payload, report } = sanitizeNotificationPayloadWithReport({
      title: "T",
      body: "B",
      category,
      data,
    });
    for (const k of allowed) expect(payload.data?.[k]).toBe(`v-${k}`);
    expect(payload.data?.hostile_extra).toBeUndefined();
    expect(report.notAllowlistedKeys).toContain("/data/hostile_extra");
    expect(report.allowlistApplied).toBe(category);
  });
});

describe("strict allowlist — mode toggles", () => {
  it("unknown category + default mode: legacy denylist only (no allowlist)", () => {
    const { payload, report } = sanitizeNotificationPayloadWithReport({
      title: "T",
      body: "B",
      category: "made_up_category_xyz",
      data: { arbitrary_field: "kept-in-legacy", email: "leak@x.com" },
    });
    expect(payload.data?.arbitrary_field).toBe("kept-in-legacy");
    expect(report.allowlistApplied).toBeNull();
    // Denylist still runs.
    expect(report.removedKeys).toContain("/data/email");
  });

  it("strict:true on unknown category drops EVERY data key", () => {
    const { payload, report } = sanitizeNotificationPayloadWithReport(
      {
        title: "T",
        body: "B",
        category: "made_up_category_xyz",
        data: { anything: 1, else: 2 },
      },
      { strict: true },
    );
    expect(payload.data).toBeUndefined();
    expect(report.allowlistApplied).toBe("__strict_empty__");
    expect(report.notAllowlistedKeys).toEqual(
      expect.arrayContaining(["/data/anything", "/data/else"]),
    );
  });

  it("strict:false on known category disables the allowlist (escape hatch)", () => {
    const { payload, report } = sanitizeNotificationPayloadWithReport(
      {
        title: "T",
        body: "B",
        category: "messages",
        data: { conversation_id: "c1", extra_flag: true },
      },
      { strict: false },
    );
    expect(payload.data?.extra_flag).toBe(true);
    expect(report.allowlistApplied).toBeNull();
    expect(report.notAllowlistedKeys).toEqual([]);
  });
});

describe("strict allowlist — hostile data payloads for messages", () => {
  const HOSTILE_KEYS = [
    "preview",
    "snippet",
    "message",
    "media_url",
    "photo_url",
    "voice_url",
    "caption",
    "hiv_status",
    "hiv_test_date_enc",
    "lat",
    "lng",
    "location",
    "email",
    "phone_e164",
    "fingerprint",
    "endpoint",
    "reply_to",
    "quoted",
    "transcript",
    "orientation",
    "tribes",
  ];

  it("drops every hostile key regardless of nesting depth at the top", () => {
    const data: Record<string, unknown> = {
      conversation_id: "c",
      actor_id: "u",
      sent_at: "now",
    };
    for (const k of HOSTILE_KEYS) data[k] = "hostile-value";
    const { payload, report } = sanitizeNotificationPayloadWithReport({
      title: "X",
      body: "Y",
      category: "messages",
      data,
    });
    for (const k of HOSTILE_KEYS) {
      expect(payload.data?.[k]).toBeUndefined();
    }
    expect(payload.data).toEqual({
      conversation_id: "c",
      actor_id: "u",
      sent_at: "now",
    });
    // Every hostile key must be reported either as denylisted or allowlist-blocked.
    for (const k of HOSTILE_KEYS) {
      const path = `/data/${k}`;
      const found =
        report.removedKeys.includes(path) ||
        report.notAllowlistedKeys.includes(path);
      expect(found, `${path} must appear in removedKeys or notAllowlistedKeys`).toBe(true);
    }
  });
});

describe("registerNotificationCategoryAllowlist", () => {
  const CATEGORY = "test_category_iso";

  beforeEach(() => {
    registerNotificationCategoryAllowlist(CATEGORY, ["approved_key"]);
  });

  it("registers a new category and enforces it", () => {
    const { payload, report } = sanitizeNotificationPayloadWithReport({
      title: "T",
      body: "B",
      category: CATEGORY,
      data: { approved_key: "ok", rogue: "drop" },
    });
    expect(payload.data).toEqual({ approved_key: "ok" });
    expect(report.allowlistApplied).toBe(CATEGORY);
    expect(report.notAllowlistedKeys).toContain("/data/rogue");
  });

  it("getNotificationCategoryAllowlists returns the registered set", () => {
    const all = getNotificationCategoryAllowlists();
    expect(all[CATEGORY]).toEqual(["approved_key"]);
    // Sanity: built-in ones are still there.
    expect(all.messages).toEqual(
      expect.arrayContaining(["conversation_id", "actor_id", "sent_at"]),
    );
  });
});

describe("strict allowlist — payload API convenience", () => {
  it("sanitizeNotificationPayload (no report) also enforces the allowlist", () => {
    const p = sanitizeNotificationPayload({
      title: "T",
      body: "B",
      category: "match",
      data: { match_id: "m1", secret_note: "x" },
    });
    expect(p.data).toEqual({ match_id: "m1" });
  });
});
