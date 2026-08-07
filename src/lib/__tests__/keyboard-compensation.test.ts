/**
 * O SINGURĂ compensare pentru tastatură pe Android.
 *
 * Istoric, dovedit pe telefon real:
 *   build 21 — `resizeOnFullScreen: true` + padding din CSS  → composer urcat
 *              de două ori, ieșea din containerul cu `overflow-hidden`;
 *   build 22 — `resizeOnFullScreen: false` + padding din CSS → composer nu
 *              urca deloc: insetul IME nu ajungea niciodată în CSS.
 *
 * Concluzia A/B: pe Android compensează NATIV pluginul, iar CSS-ul trebuie să
 * adauge exact 0. Testul blochează ambele regresii — dacă cineva repornește
 * padding-ul din CSS fără să oprească resize-ul nativ (sau invers), pică aici.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const config = readFileSync(resolve(process.cwd(), "capacitor.config.ts"), "utf8");

/** Elimină comentariile, ca explicațiile istorice să nu treacă drept cod. */
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
const configCode = config.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("compensarea tastaturii pe Android", () => {
  it("pluginul redimensionează nativ WebView-ul", () => {
    expect(configCode).toMatch(/resizeOnFullScreen:\s*true/);
  });

  it("CSS-ul nu mai adaugă nimic pe native — altfel e dubla compensare din build 21", () => {
    expect(cssCode).toMatch(/html\.native-app\s*\{[^}]*--keyboard-inset:\s*0px/);
  });

  it("pe web rămâne compensarea CSS, unde nu există resize nativ", () => {
    // `max`, nu sumă: sursele descriu aceeași tastatură.
    expect(cssCode).toMatch(/--keyboard-inset:\s*max\(/);
  });

  it("composer-ul consumă exclusiv `--keyboard-inset`, niciodată sursele brute", () => {
    const bar = cssCode.match(/@utility pb-bar \{[^}]*\}/)?.[0] ?? "";
    expect(bar).toContain("--keyboard-inset");
    expect(bar).not.toContain("--android-keyboard-height");
    expect(bar).not.toContain("--keyboard-height,");
    expect(bar).not.toContain("--visual-keyboard-height");
  });

  it("cu tastatura deschisă nu se mai rezervă spațiu pentru bara de navigație", () => {
    // Bara e acoperită de tastatură; altfel composer-ul plutește cu încă un
    // navbar deasupra ei.
    expect(cssCode).toMatch(/html\[data-keyboard-open="true"\]\s*\{[^}]*--safe-bottom:\s*0px/);
  });
});
