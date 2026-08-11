/**
 * Bundle-ul din APK trebuie să aibă culori și pe WebView-uri vechi.
 *
 * Tailwind 4 emite `oklch()`, care cere Chrome 111+ (martie 2023). `minSdk` este
 * 24, deci un telefon din 2020 cu Android System WebView neactualizat rulează un
 * motor mai vechi, unde declarația e INVALIDĂ și e ARUNCATĂ — aplicația rămâne
 * fără culori, nu doar cu nuanțe puțin diferite.
 *
 * Capcana care a costat trei build-uri: proiectul are DOUĂ configuri Vite.
 * `bun run build:mobile` folosește `vite.mobile.config.ts`, deci orice plugin
 * pus doar în `vite.config.ts` NU ajunge niciodată în APK.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const root = process.cwd();
const mobileConfig = readFileSync(resolve(root, "vite.mobile.config.ts"), "utf8");
const webConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");

describe("fallback-uri CSS pentru WebView vechi", () => {
  it("pluginul este înregistrat în configul MOBIL — cel care produce APK-ul", () => {
    expect(mobileConfig).toContain("legacyCssFallbacks()");
  });

  it("NU este în configul web: rulează după calculul hash-ului, deci ar servi CSS din cache", () => {
    expect(webConfig).not.toContain("legacyCssFallbacks()");
  });

  it("pluginul țintește un motor de pe telefoanele din 2020", () => {
    const plugin = readFileSync(resolve(root, "scripts/vite-legacy-css.ts"), "utf8");
    expect(plugin).toMatch(/chrome:\s*CHROME_90/);
    expect(plugin).toMatch(/android:\s*CHROME_90/);
  });
});

// Rulează doar când există un build mobil pe disc (local după `build:mobile`,
// și în CI pe joburile care construiesc). Fără build, nu inventăm un verdict.
const assetsDir = resolve(root, "dist/client/assets");
const cssFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((f) => f.startsWith("styles-") && f.endsWith(".css"))
  : [];

// Citirea se face DIN interiorul testelor, nu în corpul lui `describe`:
// `describe.runIf(false)` marchează suita ca sărită, dar corpul callback-ului
// este oricum evaluat la colectare. Cu build-ul absent, `cssFiles[0]` este
// `undefined` și `join()` arunca ERR_INVALID_ARG_TYPE — testul pica exact pe
// mașinile unde ar fi trebuit doar să nu ruleze.
const readCss = () => readFileSync(join(assetsDir, cssFiles[0]), "utf8");

describe.runIf(cssFiles.length > 0)("bundle-ul construit", () => {
  it("nu conține `oklch()`, pe care motoarele sub Chrome 111 nu îl înțeleg", () => {
    expect(readCss()).not.toContain("oklch(");
  });

  it("culorile moderne stau în spatele unui `@supports`", () => {
    // Cascada corectă: valoarea simplă întâi, varianta modernă gated după ea.
    // Motoarele vechi nu intră în bloc și rămân cu prima valoare.
    expect(readCss()).toContain("@supports (color:lab(");
  });

  it("variabilele de temă au o valoare pe care o citește orice motor", () => {
    // `--primary:#de41ff` înainte de `--primary:lab(...)`.
    expect(readCss()).toMatch(/--primary:#[0-9a-f]{3,8}/i);
  });

  it("tema nu depinde EXCLUSIV de culori moderne", () => {
    const hex = (readCss().match(/:#[0-9a-f]{3,8}/gi) ?? []).length;
    expect(hex).toBeGreaterThan(100);
  });
});
