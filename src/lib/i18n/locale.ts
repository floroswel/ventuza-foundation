// Locale detection + persistence for UI labels (options, chips).
// Uses i18next as the single source of truth so onboarding shell, profile
// chips, and any other option label all agree on the same locale. DB values
// stay canonical English keys — this only affects display.
//
// First launch: i18next-browser-languagedetector reads navigator.language,
// caches the resolved value in localStorage ("vz-lang") and honours the
// supportedLngs list from `src/lib/i18n.ts`. `resolvedLanguage` gives us the
// locale i18n will actually serve (e.g. "ro"/"en" today), so the option
// dictionary can't drift ahead of the shell.

import { useEffect, useState } from "react";
import i18n, { APP_LANGUAGE_CODES, type AppLanguage } from "@/lib/i18n";

// Sursa unică a limbilor: registrul din `src/locales/index.ts`.
export const SUPPORTED_UI_LOCALES = APP_LANGUAGE_CODES as readonly AppLanguage[];
export type UiLocale = AppLanguage;

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

/** Prefer what i18n will actually render (respects supportedLngs + fallback). */
function currentI18nLocale(): UiLocale {
  return normalize(i18n.resolvedLanguage ?? i18n.language);
}

export function loadUiLocale(): UiLocale {
  return currentI18nLocale();
}

/** React hook — re-renders when i18next language changes. */
export function useUiLocale(): UiLocale {
  // Start with a stable default ("en") on both server and initial client render
  // to avoid SSR hydration mismatch — the real locale is applied in useEffect
  // after hydration, so first paint matches server output.
  const [locale, setLocale] = useState<UiLocale>("en");
  useEffect(() => {
    function onChange() {
      setLocale(currentI18nLocale());
    }
    i18n.on("languageChanged", onChange);
    // If i18n finishes initializing after mount (SSR hydrate), sync once.
    if (i18n.isInitialized) onChange();
    else i18n.on("initialized", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
      i18n.off("initialized", onChange);
    };
  }, []);
  return locale;
}

