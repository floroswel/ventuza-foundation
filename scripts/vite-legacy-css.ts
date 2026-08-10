/**
 * Culori de rezervă pentru WebView-uri vechi (telefoane din 2020 încoace).
 *
 * PROBLEMA: Tailwind 4 emite `oklch()` și `color-mix()`, ambele cerând
 * Chrome 111+ (martie 2023). `minSdkVersion` este 24, iar un telefon din 2020
 * cu Android System WebView neactualizat rulează un motor mult mai vechi.
 * Acolo declarațiile de culoare sunt INVALIDE și browserul le ARUNCĂ complet —
 * aplicația nu arată „puțin altfel”, ci rămâne fără culori.
 *
 * SOLUȚIA: Lightning CSS coboară fiecare culoare la `rgb()` și păstrează
 * varianta modernă imediat după, deci motoarele noi citesc `oklch` iar cele
 * vechi `rgb`. La fel pentru `color-mix()`, care e calculat la build.
 *
 * DE CE un plugin și nu `css.lightningcss.targets`:
 * `@lovable.dev/vite-tanstack-config` își impune propriul
 * `css: { transformer: "lightningcss" }` fără `targets`, iar valoarea lui
 * câștigă la merge — CSS-ul ieșea byte-identic. Aici procesăm bundle-ul deja
 * emis, deci rezultatul nu depinde de ordinea de merge.
 *
 * DOAR pentru build-ul mobil. Proiectul are DOUĂ configuri Vite:
 * `vite.config.ts` produce web-ul (SSR), `vite.mobile.config.ts` produce
 * bundle-ul din APK/AAB. Pluginul rulează după ce Vite a calculat hash-ul din
 * numele fișierului, deci conținutul se schimbă fără ca hash-ul să se schimbe.
 * În APK e inofensiv (asset-urile sunt împachetate la fiecare build), dar pe web
 * ar servi CSS învechit din cache — de aceea nu îl punem în configul web.
 * Browserele de desktop și mobil se actualizează singure; WebView-urile blocate
 * pe versiuni vechi există doar pe Android.
 *
 * LIMITĂ CUNOSCUTĂ: `color-mix()` NU poate fi coborât când argumentele conțin
 * `var()` — exact forma folosită de Tailwind pentru variantele cu transparență
 * (`bg-primary/10`). Culorile solide primesc fallback, cele translucide nu se
 * aplică pe motoare sub Chrome 111. Aplicația rămâne utilizabilă, cu câteva
 * fundaluri și borduri lipsă, în loc să rămână complet fără culori.
 */
import type { Plugin } from "vite";

/** Lightning CSS codifică versiunile ca (major << 16) | (minor << 8) | patch. */
const CHROME_90 = 90 << 16;

export function legacyCssFallbacks(): Plugin {
  return {
    name: "suzeta:legacy-css-fallbacks",
    apply: "build",
    async generateBundle(_options, bundle) {
      const { transform } = await import("lightningcss");
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== "asset" || !fileName.endsWith(".css")) continue;
        const source =
          typeof asset.source === "string" ? asset.source : Buffer.from(asset.source).toString();
        try {
          const { code } = transform({
            filename: fileName,
            code: Buffer.from(source),
            minify: true,
            targets: { chrome: CHROME_90, android: CHROME_90 },
          });
          asset.source = code.toString();
        } catch (e) {
          // Nu blocăm buildul pentru un fișier CSS: mai bine fără fallback-uri
          // decât fără aplicație. Warning-ul rămâne în logul de build.
          this.warn(`legacy-css-fallbacks: ${fileName} — ${(e as Error).message}`);
        }
      }
    },
  };
}
