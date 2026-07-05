// Locale detection + persistence for UI labels (options, chips).
// Uses i18next as the single source of truth so it stays in sync with the
// existing LanguageSwitcher in Settings. DB values remain canonical English
// keys — this only affects display.

import { useEffect, useState } from "react";
import i18n from "@/lib/i18n";

export const SUPPORTED_UI_LOCALES = ["ro", "en", "de", "fr", "es", "it", "pt", "nl", "pl"] as const;
export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

export function detectDeviceLocale(): UiLocale {
  if (typeof navigator === "undefined") return "en";
  const nav = navigator;
  const raw =
    (nav.languages && nav.languages[0]) || nav.language || (nav as { userLanguage?: string }).userLanguage || "en";
  const code = String(raw).toLowerCase().split(/[-_]/)[0] as UiLocale;
  return (SUPPORTED_UI_LOCALES as readonly string[]).includes(code) ? code : "en";
}

function normalize(code: string | undefined | null): UiLocale {
  if (!code) return detectDeviceLocale();
  const short = code.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_UI_LOCALES as readonly string[]).includes(short) ? (short as UiLocale) : "en";
}

export function loadUiLocale(): UiLocale {
  return normalize(i18n.language);
}

/** React hook — re-renders when i18next language changes. */
export function useUiLocale(): UiLocale {
  const [locale, setLocale] = useState<UiLocale>(() => loadUiLocale());
  useEffect(() => {
    function onChange(lng: string) {
      setLocale(normalize(lng));
    }
    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, []);
  return locale;
}
