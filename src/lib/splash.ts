/**
 * Ascunderea splash-ului nativ, legată de conținut real.
 *
 * Configurația veche folosea `launchAutoHide: true` cu `launchShowDuration:
 * 900`, iar `SplashScreen.hide()` nu era apelat nicăieri. Un cronometru fix
 * greșește în ambele sensuri:
 *
 *   · aplicația gata în 300ms → 600ms de așteptare inutilă;
 *   · pornire de 3s          → splash-ul pleacă la 900ms și rămâne un ecran
 *                              gol vizibil 2 secunde.
 *
 * Acum splash-ul stă exact cât trebuie: dispare la primul frame în care
 * aplicația chiar are ce arăta.
 *
 * DE CE `requestAnimationFrame` dublu: primul cadru se declanșează după ce
 * React a comis DOM-ul, dar ÎNAINTE ca browserul să fi pictat. Ascunderea
 * acolo ar descoperi un ecran încă nedesenat — un flash alb între splash și
 * conținut. Al doilea cadru rulează după pictare, deci tranziția e curată.
 *
 * Plasă de siguranță: dacă nimeni nu apelează `hideSplash()` (o excepție în
 * bootstrap, o rută care nu semnalează), `launchShowDuration: 4000` din
 * `capacitor.config.ts` scoate splash-ul oricum. Aplicația nu poate rămâne
 * blocată pe el.
 */

let hidden = false;

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/**
 * Ascunde splash-ul nativ o singură dată, după ce cadrul curent a fost pictat.
 * No-op pe web și la apeluri repetate.
 */
export function hideSplash(): void {
  if (hidden || !isNative()) return;
  hidden = true;

  const run = () => {
    void import("@capacitor/splash-screen")
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
      .catch(() => {
        /* pluginul lipsește sau splash-ul e deja ascuns — irelevant */
      });
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(run));
  } else {
    run();
  }
}
