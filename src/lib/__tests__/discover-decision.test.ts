/**
 * Like, Pass și Back au trei destinații diferite.
 *
 * Regresia reparată: `handleDecision` apela `setSelected(null)` necondiționat,
 * în capul funcției, deci TOATE trei închideau profilul și aruncau utilizatorul
 * în Grid. Testele fixează contractul care le separă.
 */
import { describe, it, expect } from "vitest";
import {
  isLike,
  nextEligibleId,
  sheetOutcomeFor,
  shouldSendDecision,
} from "@/lib/discover-decision";

const LIST = ["a", "b", "c", "d"];

describe("Like — rămâne pe profil", () => {
  it("nu închide profilul și nu trimite în Grid", () => {
    expect(sheetOutcomeFor("like", "b")).toEqual({ kind: "stay" });
  });

  it("rămâne pe profil chiar dacă nu mai există profil următor", () => {
    expect(sheetOutcomeFor("like", null)).toEqual({ kind: "stay" });
  });

  it("super like se comportă ca like", () => {
    expect(isLike("super")).toBe(true);
    expect(sheetOutcomeFor("super", "b")).toEqual({ kind: "stay" });
  });

  it("pass nu este like", () => {
    expect(isLike("pass")).toBe(false);
  });
});

describe("Like — fără duplicate", () => {
  it("primul tap trimite", () => {
    expect(shouldSendDecision("like", undefined)).toBe(true);
  });

  it("al doilea tap pe același buton nu mai trimite nimic", () => {
    expect(shouldSendDecision("like", "like")).toBe(false);
  });

  it("schimbarea deciziei trimite din nou", () => {
    expect(shouldSendDecision("like", "pass")).toBe(true);
    expect(shouldSendDecision("pass", "like")).toBe(true);
  });

  it("un Pass repetat nu se retrimite", () => {
    expect(shouldSendDecision("pass", "pass")).toBe(false);
  });
});

describe("Pass — trece la profilul următor, nu în Grid", () => {
  it("merge la următorul profil din listă", () => {
    expect(sheetOutcomeFor("pass", nextEligibleId(LIST, "b"))).toEqual({
      kind: "advance",
      next: "c",
    });
  });

  it("sare peste profilurile deja trecute cu Pass", () => {
    expect(nextEligibleId(LIST, "a", new Set(["b", "c"]))).toBe("d");
  });

  it("la ultimul profil merge înapoi, nu în Grid", () => {
    expect(sheetOutcomeFor("pass", nextEligibleId(LIST, "d"))).toEqual({
      kind: "advance",
      next: "c",
    });
  });

  it("închide abia când nu mai există niciun profil eligibil", () => {
    expect(nextEligibleId(["a"], "a")).toBeNull();
    expect(sheetOutcomeFor("pass", nextEligibleId(["a"], "a"))).toEqual({ kind: "close" });
  });

  it("închide dacă toate celelalte au fost deja trecute", () => {
    expect(nextEligibleId(LIST, "a", new Set(["b", "c", "d"]))).toBeNull();
  });

  it("profilul curent nu se auto-selectează ca următor", () => {
    expect(nextEligibleId(LIST, "b")).not.toBe("b");
  });

  it("un profil care nu mai e în listă nu propune un următor arbitrar", () => {
    expect(nextEligibleId(LIST, "zzz")).toBeNull();
  });

  it("lista goală nu aruncă", () => {
    expect(nextEligibleId([], "a")).toBeNull();
  });
});

describe("ordinea listei este respectată", () => {
  it("următorul este vecinul imediat, nu primul din listă", () => {
    // Ordinea vine din Discover (online, distanță, last_seen) și nu se rescrie.
    expect(nextEligibleId(["d", "c", "b", "a"], "c")).toBe("b");
  });
});
