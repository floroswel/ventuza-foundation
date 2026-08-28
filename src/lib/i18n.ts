import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import {
  APP_LANGUAGE_CODES,
  RESOURCES,
  loadLanguageDict,
  normalizeLanguage,
  type AppLanguage,
} from "@/locales";

export type { AppLanguage };
export { APP_LANGUAGES, APP_LANGUAGE_CODES, languageMeta, normalizeLanguage } from "@/locales";

// Lanț de fallback: orice cheie netradusă cade pe engleză, iar variantele
// regionale ("de-AT", "pt-BR", "ro-MD") sunt normalizate la limba de bază.
const SMART_FALLBACKS: Record<string, string[]> = {
  md: ["ro", "en"],
  "ro-md": ["ro", "en"],
  "pt-br": ["pt", "en"],
  default: ["en"],
};

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: RESOURCES as never,
      fallbackLng: SMART_FALLBACKS,
      supportedLngs: APP_LANGUAGE_CODES,
      // "en-US"/"de-AT"/"ro-RO" → limba de bază, fără să sară la default.
      nonExplicitSupportedLngs: true,
      load: "languageOnly",

      interpolation: { escapeValue: false },
      detection: {
        // Prima lansare: citim navigator.language (locale-ul OS-ului).
        // `htmlTag` e scos intenționat din lanț: SSR randează <html lang="ro">,
        // iar dacă l-am include, orice locale nesuportat ar ateriza în română.
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "vz-lang",
        caches: ["localStorage"],
      },
    })
    .then(async () => {
      // Detectorul poate alege, la prima pornire, o limbă încărcată leneș
      // (telefon setat pe germană, poloneză etc.). Fără pasul ăsta,
      // utilizatorul ar primi engleza — regresie față de comportamentul de
      // dinainte de lazy-loading. Încărcăm dicționarul și îl atașăm; pentru
      // `ro`/`en` funcția iese imediat, deci nu costă nimic în cazul comun.
      await ensureLanguageLoaded(normalizeLanguage(i18n.resolvedLanguage ?? i18n.language));
      if (typeof document !== "undefined") {
        document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language ?? "en";
      }
    });

  i18n.on("languageChanged", (lng) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lng;
    }
  });
}

/**
 * Se asigură că dicționarul unei limbi este atașat înainte de a comuta pe ea.
 *
 * `ro` și `en` sunt împachetate, deci ies imediat. Restul se descarcă o
 * singură dată; `addResourceBundle` este idempotent aici pentru că verificăm
 * întâi dacă pachetul există deja.
 *
 * Eșecul nu aruncă: i18next cade cheie-cu-cheie pe engleză, exact ca pentru
 * orice dicționar parțial. O limbă lipsă degradează, nu strică ecranul.
 */
export async function ensureLanguageLoaded(lng: AppLanguage): Promise<void> {
  if (i18n.hasResourceBundle(lng, "translation")) return;
  const dict = await loadLanguageDict(lng);
  if (dict) i18n.addResourceBundle(lng, "translation", dict, true, true);
}

export default i18n;

/** Limba activă, normalizată la un cod din registru. */
export function currentLanguage(): AppLanguage {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

export async function setLanguage(lng: AppLanguage) {
  const target = normalizeLanguage(lng);
  // Întâi dicționarul, apoi comutarea: altfel primul render după schimbare ar
  // afișa engleza și abia apoi limba cerută — un flicker vizibil.
  await ensureLanguageLoaded(target);
  await i18n.changeLanguage(target);
  if (typeof document !== "undefined") {
    document.documentElement.lang = target;
    try {
      window.localStorage.setItem("vz-lang", target);
    } catch {
      /* storage blocked */
    }
  }
  // Persistăm în profil ca vizitatorii din alte țări să primească textele
  // publice ale acestui cont traduse automat în limba lor.
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user?.id) {
      await supabase
        .from("profiles")
        .update({ preferred_language: target })
        .eq("id", auth.user.id);
    }
  } catch {
    /* offline / neautentificat — best effort */
  }
}

/**
 * Pe Capacitor nativ, `navigator.language` din WebView poate rămâne blocat pe
 * locale-ul default al WebView-ului, nu al telefonului. Citim limba reală a
 * device-ului și o aplicăm o singură dată, doar dacă userul NU a ales manual.
 */
export async function syncNativeDeviceLanguage(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    if (window.localStorage.getItem("vz-lang")) return; // alegere manuală
    const { Device } = await import("@capacitor/device");
    const { value } = await Device.getLanguageCode();
    const target = normalizeLanguage(value);
    if (i18n.resolvedLanguage !== target) {
      // Calea nativă: limba telefonului poate fi una încărcată leneș (maghiară
      // sau poloneză sunt frecvente în România). Dicționarul întâi.
      await ensureLanguageLoaded(target);
      await i18n.changeLanguage(target);
    }
    if (typeof document !== "undefined") document.documentElement.lang = target;
  } catch {
    /* plugin absent / offline — rămâne detecția din navigator */
  }
}
