import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regresie build 25: variabilele `--safe-*` ajunseseră definite DOAR în
 * `html[data-keyboard-open="true"]`, deci în starea normală erau nedefinite.
 * Consecință pe Android edge-to-edge: `body { padding-top: var(--safe-top) }`
 * devenea invalid → conținutul intra sub bara de stare și sub bara gestuală
 * („aplicația nu se adaptează", conținut tăiat sus/jos).
 */
const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

function blockFor(selector: string, from = 0): string {
  const idx = css.indexOf(selector, from);
  expect(idx, `selector lipsă: ${selector}`).toBeGreaterThan(-1);
  const start = css.indexOf("{", idx);
  let depth = 0;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i);
    }
  }
  throw new Error(`bloc neînchis pentru ${selector}`);
}

describe("safe-area CSS variables", () => {
  // Blocul :root din @layer base — cel care conține insets-urile.
  const root = blockFor(":root", css.indexOf("@layer base"));


  it.each(["--safe-top", "--safe-bottom", "--safe-left", "--safe-right"])(
    "%s este definit pe :root",
    (name) => {
      expect(root).toContain(`${name}:`);
    },
  );

  it("folosește env() cu fallback și insets injectate nativ", () => {
    expect(root).toMatch(
      /--safe-top:\s*max\(env\(safe-area-inset-top,\s*0px\),\s*var\(--android-inset-top,\s*0px\)\)/,
    );
  });

  it("keyboard-open anulează doar spațiul de jos", () => {
    const kb = blockFor('html[data-keyboard-open="true"]');
    expect(kb).toContain("--safe-bottom: 0px");
    expect(kb).not.toContain("--safe-top:");
  });

  it("body rezervă spațiu pentru barele de sistem", () => {
    expect(css).toMatch(/padding-top:\s*var\(--safe-top\)/);
    expect(css).toMatch(/padding-bottom:\s*var\(--safe-bottom\)/);
  });
});
