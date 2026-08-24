import { describe, it, expect } from "vitest";
import { parseReferrer, withUtm, sanitizeDeepLinkPath } from "@/lib/deferred-deeplink";
describe("deferred deeplink", () => {
  it("parses play referrer", () => {
    const l = parseReferrer("utm_source=hero_cta&utm_medium=web_app&utm_campaign=install_funnel&dl=%2Fvenues%2F12");
    expect(l?.path).toBe("/venues/12");
    expect(l?.utm['utm_source']).toBe("hero_cta");
  });
  it("keeps utm on target", () => {
    expect(withUtm("/nearby", { utm_source: "x" })).toBe("/nearby?utm_source=x");
  });
  it("rejects external", () => {
    expect(sanitizeDeepLinkPath("//evil.com")).toBeNull();
    expect(sanitizeDeepLinkPath("https://suzeta.ro/events/3")).toBe("/events/3");
  });
});
