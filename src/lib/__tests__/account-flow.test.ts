import { describe, expect, it } from "vitest";
import { computeAccountFlow } from "@/lib/account-flow";

describe("computeAccountFlow — flux cont nou (email → onboarding → Didit)", () => {
  it("cont proaspăt: pasul curent este confirmarea emailului, restul blocate", () => {
    const flow = computeAccountFlow({
      emailConfirmed: false,
      profileComplete: false,
      ageStatus: "unverified",
    });
    expect(flow.currentStep).toBe("email");
    expect(flow.steps.map((s) => s.state)).toEqual(["current", "blocked", "blocked"]);
    expect(flow.headline).toContain("Confirmă emailul");
    expect(flow.done).toBe(false);
  });

  it("email confirmat, profil incomplet: pasul curent este profilul", () => {
    const flow = computeAccountFlow({
      emailConfirmed: true,
      profileComplete: false,
      ageStatus: "unverified",
    });
    expect(flow.currentStep).toBe("profile");
    expect(flow.steps[2]!.state).toBe("blocked");
  });

  it("email + profil gata: pasul curent este verificarea 18+ cu instrucțiune de pornire", () => {
    const flow = computeAccountFlow({
      emailConfirmed: true,
      profileComplete: true,
      ageStatus: "unverified",
    });
    expect(flow.currentStep).toBe("didit");
    expect(flow.steps[2]!.nextAction).toMatch(/Pornește verificarea/);
  });

  it("sesiune Didit deschisă: mesaj de așteptare, nu de pornire", () => {
    const flow = computeAccountFlow({
      emailConfirmed: true,
      profileComplete: true,
      ageStatus: "unverified",
      hasDiditSession: true,
    });
    expect(flow.steps[2]!.nextAction).toMatch(/Lasă pagina deschisă/);
  });

  it("Didit eșuat: recomandare clară de reluare", () => {
    const flow = computeAccountFlow({
      emailConfirmed: true,
      profileComplete: true,
      ageStatus: "failed",
    });
    expect(flow.steps[2]!.nextAction).toMatch(/Reia verificarea/);
    expect(flow.done).toBe(false);
  });

  it("sesiune expirată: descriere dedicată", () => {
    const flow = computeAccountFlow({
      emailConfirmed: true,
      profileComplete: true,
      ageStatus: "expired",
    });
    expect(flow.steps[2]!.description).toMatch(/expirat/);
  });

  it("totul complet: fără pas curent, flux încheiat", () => {
    const flow = computeAccountFlow({
      emailConfirmed: true,
      profileComplete: true,
      ageStatus: "verified",
    });
    expect(flow.done).toBe(true);
    expect(flow.currentStep).toBeNull();
    expect(flow.steps.every((s) => s.nextAction === null)).toBe(true);
  });

  it("regresie: verificat 18+ dar email neconfirmat nu marchează fluxul complet", () => {
    const flow = computeAccountFlow({
      emailConfirmed: false,
      profileComplete: true,
      ageStatus: "verified",
    });
    expect(flow.done).toBe(false);
    expect(flow.currentStep).toBe("email");
  });
});
