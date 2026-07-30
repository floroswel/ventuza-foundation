import { describe, it, expect } from "vitest";
import {
  redact,
  safeUrl,
  classify,
  severityFor,
  fingerprint,
  decide,
  FORBIDDEN_AUTO_CATEGORIES,
} from "@/lib/guardian/core";

describe("guardian · redaction", () => {
  it("elimină JWT-uri", () => {
    const t = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.abcdefgh";
    expect(redact(t)).not.toContain("eyJhbGciOi");
  });
  it("elimină email și telefon", () => {
    const out = redact("user test@example.com sunat la +40 722 333 444");
    expect(out).not.toContain("test@example.com");
    expect(out).not.toMatch(/722/);
  });
  it("elimină coordonate precise", () => {
    expect(redact("pos 44.43225, 26.10626")).toContain("[REDACTED_COORDS]");
  });
  it("elimină token din perechi cheie-valoare", () => {
    expect(redact('{"access_token":"abc123secret"}')).not.toContain("abc123secret");
  });
  it("safeUrl scoate query string-ul", () => {
    expect(safeUrl("https://x.dev/api?token=abc")).toBe("https://x.dev/api");
  });
});

describe("guardian · clasificare", () => {
  it("detectează sesiune expirată", () => {
    expect(classify("JWT expired")).toBe("session");
  });
  it("detectează rețea", () => {
    expect(classify("Failed to fetch")).toBe("network");
  });
  it("detectează plăți", () => {
    expect(classify("RevenueCat purchase failed")).toBe("payments");
  });
  it("severitate critică pentru plăți și RLS", () => {
    expect(severityFor("payments", "purchase failed")).toBe("critical");
    expect(severityFor("database", "permission denied for table profiles")).toBe("critical");
  });
});

describe("guardian · fingerprint", () => {
  it("grupează erori identice cu id-uri diferite", () => {
    const a = fingerprint("api", "GET /users/8f1c0b12-3c4e-4a5b-9d6e-1f2a3b4c5d6e → 500");
    const b = fingerprint("api", "GET /users/11111111-2222-3333-4444-555555555555 → 500");
    expect(a).toBe(b);
  });
  it("separă categorii diferite", () => {
    expect(fingerprint("api", "boom")).not.toBe(fingerprint("chat", "boom"));
  });
});

describe("guardian · decision engine", () => {
  it("nu repară niciodată automat domeniile interzise", () => {
    for (const cat of FORBIDDEN_AUTO_CATEGORIES) {
      const p = decide({ category: cat, severity: "high", message: "boom" });
      expect(p.autoSafe).toBe(false);
      expect(p.action).toBe("none");
      expect(["E_approval", "F_escalate"]).toContain(p.decision);
    }
  });
  it("repară automat sesiunea expirată", () => {
    const p = decide({ category: "session", severity: "high", message: "JWT expired" });
    expect(p.autoSafe).toBe(true);
    expect(p.action).toBe("refresh_session");
    expect(p.reversible).toBe(true);
  });
  it("trece pe fallback după eșecuri repetate de rețea", () => {
    const p = decide({ category: "network", severity: "medium", message: "Failed to fetch", occurrences: 9 });
    expect(p.decision).toBe("B_fallback");
    expect(p.action).toBe("use_cached_data");
  });
  it("propune feature flag la crash UI repetat, fără execuție automată", () => {
    const p = decide({ category: "react", severity: "high", message: "render error", occurrences: 12 });
    expect(p.decision).toBe("C_feature_flag");
    expect(p.autoSafe).toBe(false);
  });
  it("orice acțiune auto e reversibilă și cu risc mic", () => {
    const cats = ["network", "timeout", "api", "supabase", "photos", "routing", "session"] as const;
    for (const c of cats) {
      const p = decide({ category: c, severity: "medium", message: "x" });
      if (p.autoSafe) {
        expect(p.reversible).toBe(true);
        expect(p.risk).toBe("low");
      }
    }
  });
});
