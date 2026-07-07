/**
 * Tests for the structured redaction report emitted by
 * `sanitizeNotificationPayloadWithReport` and the pluggable
 * `setNotificationSanitizeLogger` audit sink.
 *
 * Rule: the report records the SHAPE of what was scrubbed (JSON paths + kinds
 * + counts) and NEVER stores the removed data itself. These tests assert both
 * halves: the report is populated correctly AND no raw PII value appears in
 * any field of the report.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sanitizeNotificationPayloadWithReport,
  sanitizeNotificationPayload,
  setNotificationSanitizeLogger,
  type SanitizeAuditLogger,
} from "@/lib/notification-privacy";

// A canary string we can grep the entire report for to prove no raw value
// slipped into the audit output.
const RAW_EMAIL = "leaked-user@example.com";
const RAW_PHONE = "+40712345678";
const RAW_IBAN = "RO49AAAA1B31007593840000";

function reportContainsAnyRawValue(report: unknown): boolean {
  const flat = JSON.stringify(report);
  return (
    flat.includes(RAW_EMAIL) ||
    flat.includes(RAW_PHONE) ||
    flat.includes(RAW_IBAN) ||
    flat.includes("leaked-user") ||
    flat.includes("40712345678") ||
    flat.includes("RO49AAAA")
  );
}

describe("sanitizeNotificationPayloadWithReport — structured report", () => {
  it("reports removedKeys with JSON-path pointers", () => {
    const { report } = sanitizeNotificationPayloadWithReport({
      title: "t",
      body: "b",
      data: {
        conversation_id: "c1",
        hiv_status: "positive",
        location: { lat: 1, lng: 2 },
        nested: { phone: RAW_PHONE, ok: 1 },
        matches: [{ id: "m", email: RAW_EMAIL }],
      },
    });
    expect(report.removedKeys).toContain("/data/hiv_status");
    expect(report.removedKeys).toContain("/data/location");
    expect(report.removedKeys).toContain("/data/nested/phone");
    expect(report.removedKeys).toContain("/data/matches/0/email");
    expect(reportContainsAnyRawValue(report)).toBe(false);
  });

  it("reports scrubbedStrings with path + kinds + count", () => {
    const { report } = sanitizeNotificationPayloadWithReport({
      title: `From ${RAW_EMAIL}`,
      body: `Call ${RAW_PHONE} or IBAN ${RAW_IBAN}`,
      category: "marketing",
      data: { conversation_id: `id ${RAW_EMAIL} ${RAW_PHONE}` },
    });

    const titleEntry = report.scrubbedStrings.find((s) => s.path === "/title");
    expect(titleEntry?.kinds).toEqual(["email"]);
    expect(titleEntry?.count).toBe(1);

    const bodyEntry = report.scrubbedStrings.find((s) => s.path === "/body");
    expect(bodyEntry?.kinds).toEqual(expect.arrayContaining(["phone", "iban"]));
    expect((bodyEntry?.count ?? 0)).toBeGreaterThanOrEqual(2);

    const dataEntry = report.scrubbedStrings.find(
      (s) => s.path === "/data/conversation_id",
    );
    expect(dataEntry?.kinds).toEqual(expect.arrayContaining(["email", "phone"]));
    expect(reportContainsAnyRawValue(report)).toBe(false);
  });

  it("flags bodyForcedGeneric when category=messages and caller passed a body", () => {
    const { report } = sanitizeNotificationPayloadWithReport({
      title: "t",
      body: "Salut, sună-mă la 20",
      category: "messages",
    });
    expect(report.bodyForcedGeneric).toBe(true);
  });

  it("does NOT flag bodyForcedGeneric when caller passed no body (messages default)", () => {
    const { report } = sanitizeNotificationPayloadWithReport({
      title: "t",
      category: "messages",
    });
    expect(report.bodyForcedGeneric).toBe(false);
  });

  it("flags urlQueryDropped when the incoming url had a query string", () => {
    const { report, payload } = sanitizeNotificationPayloadWithReport({
      title: "t", body: "b",
      url: "/m/42?token=SECRET&who=leak@x.io",
    });
    expect(report.urlQueryDropped).toBe(true);
    expect(payload.url).toBe("/m/42");
  });

  it("does NOT flag urlQueryDropped for a url without a query string", () => {
    const { report } = sanitizeNotificationPayloadWithReport({
      title: "t", body: "b", url: "/m/42",
    });
    expect(report.urlQueryDropped).toBe(false);
  });

  it("flags truncation for title/body/tag exceeding max length", () => {
    const long = "x".repeat(500);
    const { report } = sanitizeNotificationPayloadWithReport({
      title: long,
      body: long,
      tag: long,
      category: "marketing",
    });
    expect(report.truncated).toEqual({ title: true, body: true, tag: true });
  });

  it("reports unknown top-level keys as dropped (not propagated)", () => {
    const { report } = sanitizeNotificationPayloadWithReport({
      title: "t",
      body: "b",
      // unknown top-level keys the shape doesn't accept:
      random_thing: "x",
      another: 42,
    } as never);
    expect(report.droppedTopLevelKeys).toEqual(
      expect.arrayContaining(["random_thing", "another"]),
    );
  });

  it("empty report when everything is safe (no redactions)", () => {
    const { report } = sanitizeNotificationPayloadWithReport({
      title: "Andrei",
      body: "Ai un mesaj nou",
      tag: "conv",
      type: "match",
      category: "matches",
      url: "/m/42",
      data: { conversation_id: "c1", actor_id: "u1", priority: 1 },
    });
    expect(report.removedKeys).toEqual([]);
    expect(report.scrubbedStrings).toEqual([]);
    expect(report.bodyForcedGeneric).toBe(false);
    expect(report.urlQueryDropped).toBe(false);
    expect(report.truncated).toEqual({ title: false, body: false, tag: false });
    expect(report.droppedTopLevelKeys).toEqual([]);
  });
});

describe("setNotificationSanitizeLogger — pluggable audit sink", () => {
  const events: Array<Parameters<SanitizeAuditLogger>[0]> = [];

  beforeEach(() => {
    events.length = 0;
    setNotificationSanitizeLogger((e) => events.push(e));
  });

  afterEach(() => {
    setNotificationSanitizeLogger(null);
  });

  it("invokes the logger on every sanitize call with hasAnyRedaction flag", () => {
    sanitizeNotificationPayload({ title: "safe", body: "safe" });
    sanitizeNotificationPayload({
      title: `From ${RAW_EMAIL}`,
      body: "b",
      category: "marketing",
    });
    expect(events).toHaveLength(2);
    expect(events[0].hasAnyRedaction).toBe(false);
    expect(events[1].hasAnyRedaction).toBe(true);
  });

  it("passes channel / category / type through to the logger", () => {
    sanitizeNotificationPayload(
      { title: "t", body: "b", category: "messages", type: "new_message" },
      { channel: "fcm-android" },
    );
    expect(events[0]).toMatchObject({
      channel: "fcm-android",
      category: "messages",
      type: "new_message",
    });
  });

  it("never sends raw values to the logger — only structural report", () => {
    sanitizeNotificationPayload({
      title: `From ${RAW_EMAIL}`,
      body: `Call ${RAW_PHONE} IBAN ${RAW_IBAN}`,
      category: "marketing",
      data: {
        conversation_id: `id ${RAW_EMAIL}`,
        hiv_status: "positive",
        location: { lat: 44.4, lng: 26.1 },
        nested: { phone: RAW_PHONE, message: "leaked text body here" },
      },
    });
    expect(events).toHaveLength(1);
    const serialized = JSON.stringify(events[0]);
    expect(serialized).not.toContain(RAW_EMAIL);
    expect(serialized).not.toContain(RAW_PHONE);
    expect(serialized).not.toContain(RAW_IBAN);
    expect(serialized).not.toContain("positive");
    expect(serialized).not.toContain("leaked text body here");
    expect(serialized).not.toContain("44.4");
    // But it MUST contain structural evidence.
    expect(serialized).toContain("/data/hiv_status");
    expect(serialized).toContain("/data/location");
    expect(serialized).toContain("/data/nested/phone");
    expect(serialized).toContain("email");
    expect(serialized).toContain("iban");
  });

  it("a throwing logger does not break sanitization", () => {
    setNotificationSanitizeLogger(() => {
      throw new Error("logger boom");
    });
    expect(() =>
      sanitizeNotificationPayload({ title: "t", body: "b" }),
    ).not.toThrow();
  });

  it("passing null disables the logger", () => {
    setNotificationSanitizeLogger(null);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    sanitizeNotificationPayload({
      title: `From ${RAW_EMAIL}`,
      body: "b",
      category: "marketing",
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
