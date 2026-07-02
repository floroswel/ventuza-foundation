import { describe, it, expect } from "vitest";
import { derivePanelState } from "@/components/admin/admin-panel-state";
import { isForbiddenError } from "@/components/admin/AdminErrorBanner";

describe("derivePanelState — stări SLA panou admin", () => {
  it("initial: loading vizibil, fără empty/eroare", () => {
    const s = derivePanelState({
      error: null,
      hasLoadedOnce: false,
      slaError: null,
      loading: true,
      rowCount: 0,
    });
    expect(s.showInitialSpinner).toBe(true);
    expect(s.primaryBanner).toBeNull();
    expect(s.slaBanner).toBeNull();
    expect(s.showLegitEmpty).toBe(false);
  });

  it("run() eșuează la primul load → banner fatal, fără empty fals", () => {
    const s = derivePanelState({
      error: "network down",
      hasLoadedOnce: false,
      slaError: null,
      loading: false,
      rowCount: 0,
    });
    expect(s.primaryBanner).toBe("fatal");
    expect(s.showLegitEmpty).toBe(false);
    expect(s.showInitialSpinner).toBe(false);
  });

  it("refresh eșuează după ce avem date vechi → banner soft, datele rămân", () => {
    const s = derivePanelState({
      error: "timeout",
      hasLoadedOnce: true,
      slaError: null,
      loading: false,
      rowCount: 12,
    });
    expect(s.primaryBanner).toBe("soft");
    expect(s.showLegitEmpty).toBe(false);
  });

  it("empty legitim: zero rânduri fără eroare → showLegitEmpty=true, no banner", () => {
    const s = derivePanelState({
      error: null,
      hasLoadedOnce: true,
      slaError: null,
      loading: false,
      rowCount: 0,
    });
    expect(s.primaryBanner).toBeNull();
    expect(s.showLegitEmpty).toBe(true);
  });

  it("slaError apare izolat ca warning, nu blochează panoul", () => {
    const s = derivePanelState({
      error: null,
      hasLoadedOnce: true,
      slaError: "praguri indisponibile",
      loading: false,
      rowCount: 5,
    });
    expect(s.primaryBanner).toBeNull();
    expect(s.slaBanner).toBe("warning");
    expect(s.showLegitEmpty).toBe(false);
  });

  it("eroare principală + slaError simultan → afișăm ambele bannere", () => {
    const s = derivePanelState({
      error: "500 Internal",
      hasLoadedOnce: true,
      slaError: "sla down",
      loading: false,
      rowCount: 3,
    });
    expect(s.primaryBanner).toBe("soft");
    expect(s.slaBanner).toBe("warning");
  });

  it("refresh în curs (loading=true) după succes NU reafișează spinner-ul inițial", () => {
    const s = derivePanelState({
      error: null,
      hasLoadedOnce: true,
      slaError: null,
      loading: true,
      rowCount: 8,
    });
    expect(s.showInitialSpinner).toBe(false);
  });
});

describe("isForbiddenError", () => {
  it("detectează mesajele forbidden/denied/rol/policy", () => {
    expect(isForbiddenError("Forbidden: staff role required")).toBe(true);
    expect(isForbiddenError("permission denied for table")).toBe(true);
    expect(isForbiddenError("insufficient privileges")).toBe(true);
    expect(isForbiddenError("row-level security policy blocks")).toBe(true);
    expect(isForbiddenError("Rol lipsă: super_admin")).toBe(true);
  });

  it("nu marchează eroarea generică drept forbidden", () => {
    expect(isForbiddenError("network timeout")).toBe(false);
    expect(isForbiddenError("500 Internal Server Error")).toBe(false);
    expect(isForbiddenError(null)).toBe(false);
    expect(isForbiddenError(undefined)).toBe(false);
    expect(isForbiddenError("")).toBe(false);
  });
});
