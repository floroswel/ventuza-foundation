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

type WithCapacitor = Window & {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
};

let bootstrapped = false;

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
        const path = `${u.pathname}${u.search}${u.hash}`;
        if (path && path !== "/") router.navigate({ to: path, replace: false });
      } catch {
        /* ignore invalid url */
      }
    });
  } catch (err) {
    console.warn("[native] back button unavailable", err);
  }

  // 2) Keyboard resize — expunem CSS var --keyboard-height
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    Keyboard.addListener("keyboardWillShow", (info) => {
      document.documentElement.style.setProperty("--keyboard-height", `${info.keyboardHeight}px`);
      document.documentElement.dataset.keyboardOpen = "true";
    });
    Keyboard.addListener("keyboardWillHide", () => {
      document.documentElement.style.setProperty("--keyboard-height", "0px");
      delete document.documentElement.dataset.keyboardOpen;
    });
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
