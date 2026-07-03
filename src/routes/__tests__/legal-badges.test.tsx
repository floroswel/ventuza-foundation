import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BadgesCatalog } from "@/routes/legal.badges";
import { BADGES } from "@/lib/badges-registry";

describe("/legal/badges", () => {
  const html = renderToStaticMarkup(<BadgesCatalog />);

  it("randează titlul catalogului", () => {
    expect(html).toContain("Catalog Badge-uri Ventuza");
  });

  it("randează toate badge-urile din registry (label RO + criteriu)", () => {
    for (const b of Object.values(BADGES)) {
      expect(html, `lipsește label pentru ${b.code}`).toContain(b.label.ro);
      expect(html, `lipsește criteriu pentru ${b.code}`).toContain(b.criteria);
    }
  });

  it("separă badge-urile user de cele venue/event", () => {
    expect(html).toContain("Badge-uri utilizatori");
    expect(html).toContain("Badge-uri parteneri");
  });

  it("afișează condiția de expirare în HTML pentru fiecare badge care expiră", () => {
    const expiring = Object.values(BADGES).filter((b) => b.expiry !== null);
    expect(expiring.length).toBeGreaterThan(0);
    for (const b of expiring) {
      expect(html, `lipsește prefix 'Expirare:' pentru ${b.code}`).toContain(
        `Expirare: ${b.expiry}`,
      );
    }
  });

  it("nu afișează 'Expirare:' pentru badge-urile permanente", () => {
    const permanent = Object.values(BADGES).filter((b) => b.expiry === null);
    for (const b of permanent) {
      // Textul criteriului nu trebuie să fie urmat de un marker de expirare fals.
      expect(html).not.toContain(`Expirare: ${b.criteria}`);
    }
  });
});
