// Locale detection + persistence for UI labels (options, chips).
// DB values remain canonical English keys — this only affects display.

import { useEffect, useState } from "react";

export const SUPPORTED_UI_LOCALES = ["ro", "en", "de", "fr", "es", "it", "pt", "nl", "pl"] as const;
export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

const STORAGE_KEY = "ui.locale";

export function detectDeviceLocale(): UiLocale {
  if (typeof navigator === "undefined") return "en";
  const nav = navigator;
  const raw =
    (nav.languages && nav.languages[0]) || nav.language || (nav as { userLanguage?: string }).userLanguage || "en";
  const code = String(raw).toLowerCase().split(/[-_]/)[0] as UiLocale;
  return (SUPPORTED_UI_LOCALES as readonly string[]).includes(code) ? code : "en";
}

export function loadUiLocale(): UiLocale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_UI_LOCALES as readonly string[]).includes(saved)) return saved as UiLocale;
  } catch {
    /* ignore */
  }
  return detectDeviceLocale();
}

export function saveUiLocale(locale: UiLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
    window.dispatchEvent(new CustomEvent("ui-locale-changed", { detail: locale }));
  } catch {
    /* ignore */
  }
}

/** React hook — re-renders when locale changes (via saveUiLocale). */
export function useUiLocale(): UiLocale {
  const [locale, setLocale] = useState<UiLocale>(() => loadUiLocale());
  useEffect(() => {
    function onChange(e: Event) {
      const next = (e as CustomEvent<UiLocale>).detail;
      if (next) setLocale(next);
    }
    window.addEventListener("ui-locale-changed", onChange);
    return () => window.removeEventListener("ui-locale-changed", onChange);
  }, []);
  return locale;
}
