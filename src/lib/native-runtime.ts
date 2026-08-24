/**
 * Native runtime bootstrap (Capacitor Android).
 *
 * Wire-up centralizat pentru comportamente native (nu web):
 *  - Hardware Back Button Android → istoricul router-ului sau minimize app la root.
 *  - Keyboard: resize `body` cu inset când tastatura urcă (evită butoane ascunse).
 *  - StatusBar: verifică stilul dark/light la boot.
 *
 * Toate importurile de plugin-uri se fac dinamic ca să nu strice bundle-ul web
 * (SSR / preview browser).
 */

import type { Router } from "@tanstack/react-router";

import { effectiveKeyboardHeight, isKeyboardOpen } from "@/lib/keyboard-inset";

type WithCapacitor = Window & {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
};

let bootstrapped = false;
/** Ultima înălțime raportată de plugin. Citită de handlerul de Back. */
let nativeKeyboardHeight = 0;

export async function bootstrapNativeRuntime(router: Router<any, any, any, any, any>) {
  if (bootstrapped) return;
  if (typeof window === "undefined") return;
  const cap = (window as WithCapacitor).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  bootstrapped = true;

  // 0) Limba telefonului (RO pentru utilizatorii români, EN pentru restul).
  try {
    const { syncNativeDeviceLanguage } = await import("@/lib/i18n");
    await syncNativeDeviceLanguage();
  } catch {
    /* fallback: detecția din navigator */
  }


  // 1) Hardware Back Button Android
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      // Failsafe: butonul back nu trebuie să găsească UI-ul „înghețat" de
      // privacy-screen (clasa __privacy_defocused rămasă lipită).
      void import("@/lib/privacy-screen").then((m) => m.clearPrivacyDefocus()).catch(() => {});
      // Tastatura deschisă are prioritate: prima apăsare o închide și NU navighează,
      // altfel utilizatorul ar ieși din conversație doar pentru a scăpa de tastatură.
      // Verificăm și insetul IME injectat de MainActivity, ca decizia să fie corectă
      // chiar dacă pluginul nu a raportat evenimentul.
      const imeInset = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--android-keyboard-height"),
      );
      if (isKeyboardOpen(effectiveKeyboardHeight(nativeKeyboardHeight, imeInset))) {
        void import("@capacitor/keyboard")
          .then(({ Keyboard }) => Keyboard.hide())
          .catch(() => {
            // Fără plugin, scoaterea focusului închide tastatura în WebView.
            const el = document.activeElement as HTMLElement | null;
            el?.blur?.();
          });
        return;
      }
      // Închide modaluri deschise cu [data-native-back-close] înainte de a naviga.
      const closer = document.querySelector<HTMLElement>("[data-native-back-close]");
      if (closer) {
        closer.click();
        return;
      }
      // Sonner toaster / sheets: caută butoane de închidere aria-label
      const dismiss = document.querySelector<HTMLElement>(
        '[data-state="open"] [aria-label="Close"], [data-state="open"] [aria-label="Închide"]',
      );
      if (dismiss) {
        dismiss.click();
        return;
      }
      if (canGoBack || window.history.length > 1) {
        router.history.back();
      } else {
        App.exitApp();
      }
    });

    // Deep link handler — https://suzeta.app/... deschide direct în app
    // (necesită assetlinks.json + intent-filter în AndroidManifest, deja livrat).
    App.addListener("appUrlOpen", ({ url }) => {
      try {
        const u = new URL(url);
        // Query-ul (inclusiv utm_*) este păstrat intact la navigare.
        const path = `${u.pathname}${u.search}${u.hash}`;
        if (path && path !== "/") router.navigate({ to: path, replace: false });
      } catch {
        /* ignore invalid url */
      }
    });

    // Deferred deep link: dacă instalarea a pornit dintr-un link web
    // (Install Referrer Play sau intenția salvată în storage), aterizăm pe
    // pagina cerută, cu parametrii UTM păstrați în URL.
    void (async () => {
      try {
        const { resolveDeferredDeepLink, deferredTarget } = await import(
          "@/lib/deferred-deeplink"
        );
        const link = await resolveDeferredDeepLink();
        if (!link || link.path === "/") return;
        const target = deferredTarget(link);
        router.navigate({ to: target, replace: true });
        const { trackStoreFunnelOnce, installId } = await import(
          "@/lib/store-analytics"
        );
        // O singură conversie „deferred" per instalare.
        trackStoreFunnelOnce("deferred_deeplink_open", installId(), {
          source: link.origin,
          path: link.path,
          referrer: new URLSearchParams(link.utm).toString() || null,
        });
      } catch {
        /* deep link amânat indisponibil — pornim normal */
      }
    })();

  } catch (err) {
    console.warn("[native] back button unavailable", err);
  }

  // 2) Tastatura — geometria o face NATIV `@capacitor/keyboard`
  //    (`resizeOnFullScreen: true`): WebView-ul se micșorează, deci `100dvh`
  //    scade singur și CSS-ul nu mai adaugă nimic (`--keyboard-inset` este 0 pe
  //    native — vezi styles.css). Ce urmează aici este strict COMPORTAMENT:
  //      - `data-keyboard-open` → Back închide întâi tastatura;
  //      - `suzeta:keyboard`    → chatul reancorează ultimul mesaj.
  //    Înălțimea rămâne expusă prin `--keyboard-height` pentru web, unde nu
  //    există redimensionare nativă.
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    const apply = (height: number) => {
      const px = effectiveKeyboardHeight(height);
      document.documentElement.style.setProperty("--keyboard-height", `${px}px`);
      nativeKeyboardHeight = px;
      if (isKeyboardOpen(px)) document.documentElement.dataset.keyboardOpen = "true";
      else delete document.documentElement.dataset.keyboardOpen;
      // Chatul ancorează ultimul mesaj deasupra composer-ului când primește asta.
      try {
        window.dispatchEvent(new CustomEvent("suzeta:keyboard", { detail: { height: px } }));
      } catch {
        /* CustomEvent indisponibil — compensarea CSS rămâne activă */
      }
    };
    Keyboard.addListener("keyboardWillShow", (info) => apply(info.keyboardHeight));
    Keyboard.addListener("keyboardDidShow", (info) => apply(info.keyboardHeight));
    Keyboard.addListener("keyboardWillHide", () => apply(0));
    Keyboard.addListener("keyboardDidHide", () => apply(0));
  } catch (err) {
    console.warn("[native] keyboard unavailable", err);
  }

  // 3) StatusBar overlay
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0B0B10" });
  } catch {
    /* status bar poate fi indisponibil pe unele device-uri; ignore */
  }
}

/**
 * Haptic feedback wrapper — no-op pe web, feedback real pe Android.
 * Folosește pentru: like/pass, send message, tap primar critic, delete confirm.
 */
export async function haptic(kind: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "light") {
  if (typeof window === "undefined") return;
  const cap = (window as WithCapacitor).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "success" || kind === "warning" || kind === "error") {
      await Haptics.notification({
        type:
          kind === "success"
            ? NotificationType.Success
            : kind === "warning"
              ? NotificationType.Warning
              : NotificationType.Error,
      });
      return;
    }
    await Haptics.impact({
      style:
        kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    /* ignore */
  }
}

export function isNativeAndroid(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as WithCapacitor).Capacitor;
  return Boolean(cap?.isNativePlatform?.()) && cap?.getPlatform?.() === "android";
}
