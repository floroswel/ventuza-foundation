import { describe, it, expect } from "vitest";
import { classifySlaFailure } from "@/lib/admin-sla-telemetry";

describe("classifySlaFailure", () => {
  it("marchează 401/403/RLS ca forbidden", () => {
    expect(classifySlaFailure(new Error("permission denied for table"))).toBe("forbidden");
    expect(classifySlaFailure(new Error("Forbidden: staff role required"))).toBe("forbidden");
    expect(classifySlaFailure({ message: "row-level security policy" })).toBe("forbidden");
  });

  it("detectează timeout", () => {
    expect(classifySlaFailure(new Error("Cererea a depășit 20s"))).toBe("timeout");
    expect(classifySlaFailure(new Error("ETIMEDOUT"))).toBe("timeout");
  });

  it("detectează network", () => {
    expect(classifySlaFailure(new Error("Failed to fetch"))).toBe("network");
    expect(classifySlaFailure(new Error("Load failed"))).toBe("network");
    expect(classifySlaFailure(new Error("network offline"))).toBe("network");
  });

  it("detectează schema (DB) errors", () => {
    expect(classifySlaFailure(new Error('relation "foo" does not exist'))).toBe("schema");
    expect(classifySlaFailure(new Error("column x type mismatch"))).toBe("schema");
  });

  it("detectează 5xx / server", () => {
    expect(classifySlaFailure(new Error("500 Internal Server Error"))).toBe("server");
    expect(classifySlaFailure(new Error("502 Bad Gateway"))).toBe("server");
    expect(classifySlaFailure(new Error("service unavailable"))).toBe("server");
  });

  it("detectează abort", () => {
    expect(classifySlaFailure(new Error("The operation was aborted"))).toBe("aborted");
  });

  it("altele → unknown", () => {
    expect(classifySlaFailure(new Error("weird problem"))).toBe("unknown");
    expect(classifySlaFailure(null)).toBe("unknown");
    expect(classifySlaFailure(undefined)).toBe("unknown");
  });
});
