/**
 * Suzeta este publicată pe Google Play, deci vizitatorii de pe Android trebuie
 * să afle că există aplicația nativă — nu varianta instalabilă din browser,
 * care arată la fel dar nu are notificări native, tastatură corectă sau
 * deep link-uri.
 *
 * Capcana pe care o blochează testele: bannerul NU are voie să apară în
 * interiorul aplicației native. Acolo ar invita utilizatorul să instaleze ceva
 * ce rulează deja.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLAY_PACKAGE_ID,
  PLAY_STORE_URL,
  isAndroidBrowser,
  shouldShowInstallBanner,
  shouldShowStoreLink,
} from "@/lib/app-store-link";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";
const SUZETA_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

describe("adresa din Play", () => {
  it("folosește package ID-ul real al aplicației", () => {
    expect(PLAY_PACKAGE_ID).toBe("app.suzeta");
    expect(PLAY_STORE_URL).toBe("https://play.google.com/store/apps/details?id=app.suzeta");
  });

  it("este același package ID ca în assetlinks.json", () => {
    // Dacă cele două se despart, deep link-urile Android se rup tăcut.
    const links = readFileSync(resolve(process.cwd(), "public/.well-known/assetlinks.json"), "utf8");
    expect(links).toContain(PLAY_PACKAGE_ID);
  });
});

describe("cui îi arătăm bannerul", () => {
  it("unui vizitator Chrome pe Android", () => {
    expect(
      shouldShowInstallBanner({ isNative: false, userAgent: CHROME_ANDROID, dismissed: false }),
    ).toBe(true);
  });

  it("NU în aplicația nativă — acolo rulează deja", () => {
    expect(
      shouldShowInstallBanner({ isNative: true, userAgent: CHROME_ANDROID, dismissed: false }),
    ).toBe(false);
  });

  it("NU în WebView-ul aplicației, chiar dacă `isNative` ar minți", () => {
    // A doua plasă: Capacitor poate lipsi, dar user agent-ul spune adevărul.
    expect(
      shouldShowInstallBanner({ isNative: false, userAgent: SUZETA_WEBVIEW, dismissed: false }),
    ).toBe(false);
  });

  it("NU după ce utilizatorul l-a închis", () => {
    expect(
      shouldShowInstallBanner({ isNative: false, userAgent: CHROME_ANDROID, dismissed: true }),
    ).toBe(false);
  });

  it("NU pe iPhone — aplicația nu există pe iOS", () => {
    expect(shouldShowInstallBanner({ isNative: false, userAgent: IPHONE, dismissed: false })).toBe(
      false,
    );
  });

  it("NU pe desktop — acolo un banner ar fi doar zgomot", () => {
    expect(shouldShowInstallBanner({ isNative: false, userAgent: DESKTOP, dismissed: false })).toBe(
      false,
    );
  });

  it("user agent lipsă nu aruncă", () => {
    expect(isAndroidBrowser("")).toBe(false);
  });
});

describe("link-ul permanent din subsol", () => {
  it("se vede pe orice platformă web, inclusiv desktop", () => {
    expect(shouldShowStoreLink({ isNative: false })).toBe(true);
  });

  it("dispare în aplicația nativă", () => {
    expect(shouldShowStoreLink({ isNative: true })).toBe(false);
  });
});

describe("manifestul trimite către aplicația nativă", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8"),
  ) as {
    prefer_related_applications?: boolean;
    related_applications?: Array<{ platform: string; id: string; url: string }>;
  };

  it("declară aplicația din Play ca fiind cea recomandată", () => {
    // Fără asta, Chrome propune instalarea variantei din browser, care nu are
    // notificări native — exact ce NU vrem acum că aplicația e publicată.
    expect(manifest.prefer_related_applications).toBe(true);
  });

  it("indică exact aplicația noastră", () => {
    const play = manifest.related_applications?.find((a) => a.platform === "play");
    expect(play?.id).toBe(PLAY_PACKAGE_ID);
    expect(play?.url).toBe(PLAY_STORE_URL);
  });
});
