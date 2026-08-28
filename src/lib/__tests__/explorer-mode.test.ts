import { describe, expect, it } from "vitest";
import { CITIES, searchCities } from "@/lib/cities";
import { isHostileCountry } from "@/lib/hostile-countries";
import { formatRemaining, EXPLORER_MAX_HOURS } from "@/lib/travel";

describe("cities", () => {
  it("găsește orașe fără diacritice", () => {
    expect(searchCities("bucuresti")[0]?.name).toBe("București");
  });

  it("caută și după țară", () => {
    expect(searchCities("spania").every((c) => c.cc === "ES")).toBe(true);
  });

  it("nu stochează precizie mai bună de 2 zecimale (~1 km)", () => {
    for (const c of CITIES) {
      expect(Math.round(c.lat * 100) / 100).toBeCloseTo(c.lat, 10);
      expect(Math.round(c.lng * 100) / 100).toBeCloseTo(c.lng, 10);
    }
  });

  it("întoarce listă goală pentru interogări fără rezultat", () => {
    expect(searchCities("zzzzzz")).toHaveLength(0);
  });
});

describe("risc de țară", () => {
  it("marchează țările criminalizante", () => {
    expect(isHostileCountry("EG")).toBe(true);
    expect(isHostileCountry("ae")).toBe(true);
    expect(isHostileCountry("RO")).toBe(false);
    expect(isHostileCountry(null)).toBe(false);
  });
});

describe("explorer", () => {
  it("expiră la maximum 24h", () => {
    expect(EXPLORER_MAX_HOURS).toBe(24);
  });

  it("formatează timpul rămas", () => {
    const in2h = new Date(Date.now() + 2 * 3600_000 + 5 * 60_000).toISOString();
    expect(formatRemaining(in2h)).toMatch(/^2 h 0[45] m$/);
    expect(formatRemaining(new Date(Date.now() - 1000).toISOString())).toBe("expirat");
  });
});
