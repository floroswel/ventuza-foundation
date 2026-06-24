import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const ro = {
  common: {
    cancel: "Anulează",
    save: "Salvează",
    delete: "Șterge",
    confirm: "Confirmă",
    close: "Închide",
    loading: "Se încarcă...",
    error: "Eroare",
    back: "Înapoi",
    next: "Următorul",
    yes: "Da",
    no: "Nu",
    search: "Caută",
    settings: "Setări",
    profile: "Profil",
    messages: "Mesaje",
    discover: "Descoperă",
    favorites: "Favorite",
    notifications: "Notificări",
  },
  age: {
    title: "Confirmă-ți vârsta",
    desc: "Pentru siguranța comunității, trebuie să confirmi că ai peste 18 ani.",
    cta: "Verifică vârsta",
    opening: "Se deschide...",
    pending: "Verificare în curs...",
    resume: "Reia verificarea",
    failed: "Verificarea anterioară nu a reușit. Încearcă din nou.",
    check: "Am terminat — verifică statusul",
  },
  quickExit: { label: "Ieșire rapidă" },
  language: {
    title: "Limbă",
    ro: "Română",
    en: "English",
    auto: "Detectată automat",
  },
};

const en: typeof ro = {
  common: {
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    confirm: "Confirm",
    close: "Close",
    loading: "Loading...",
    error: "Error",
    back: "Back",
    next: "Next",
    yes: "Yes",
    no: "No",
    search: "Search",
    settings: "Settings",
    profile: "Profile",
    messages: "Messages",
    discover: "Discover",
    favorites: "Favorites",
    notifications: "Notifications",
  },
  age: {
    title: "Confirm your age",
    desc: "For community safety, please confirm you are over 18.",
    cta: "Verify age",
    opening: "Opening...",
    pending: "Verification in progress...",
    resume: "Resume verification",
    failed: "Previous verification failed. Try again.",
    check: "I'm done — check status",
  },
  quickExit: { label: "Quick exit" },
  language: {
    title: "Language",
    ro: "Română",
    en: "English",
    auto: "Auto-detected",
  },
};

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { ro: { translation: ro }, en: { translation: en } },
      fallbackLng: "ro",
      supportedLngs: ["ro", "en"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        lookupLocalStorage: "vz-lang",
        caches: ["localStorage"],
      },
    });
}

export default i18n;

export function setLanguage(lng: "ro" | "en") {
  void i18n.changeLanguage(lng);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
}
