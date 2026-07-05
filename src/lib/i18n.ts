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
  onboarding: {
    back: "Înapoi",
    continue: "Continuă",
    finish: "Termină",
    stepLabel: "{{name}} · {{n}}/{{total}}",
    step: {
      basics: "Despre tine",
      identity: "Identitate",
      intent: "Ce cauți",
      stats: "Profil fizic",
      personality: "Personalitate",
      photos: "Poze",
    },
    basics: {
      title: "Să te cunoaștem",
      hint: "Numele și data nașterii. Trebuie să ai 18+.",
      nameLabel: "Cum te numești?",
      namePlaceholder: "Numele tău",
      birthLabel: "Data nașterii",
      birthLocked: "Am preluat data nașterii de la înscriere. Pentru schimbări, contactează suportul.",
      minAge: "Trebuie să ai cel puțin 18 ani.",
    },
    identity: {
      title: "Identitatea ta",
      hint: "Gen, pronume și orientare. Alege orice ți se potrivește.",
      gender: "Gen",
      genderCustom: "Personalizat (opțional)",
      pronouns: "Pronume",
      pronounsCustom: "ex: ze/zir (opțional)",
      orientation: "Orientare",
    },
    intent: {
      title: "Ce cauți?",
      hint: "Alege orice se potrivește. Triburile sunt opționale.",
      looking: "Caut",
      tribes: "Triburi",
      optional: "(opțional)",
    },
    stats: {
      title: "Profilul tău fizic",
      hint: "Totul este opțional. Arată doar ce vrei tu.",
      body: "Tip corp",
      position: "Poziție",
      height: "Înălțime (cm)",
      weight: "Greutate (kg)",
      ethnicity: "Etnie",
      relationship: "Status relație",
    },
    personality: {
      title: "Cine ești",
      hint: "Interese și o scurtă bio.",
      interests: "Interese",
      min3: "(min. 3)",
      bio: "Bio scurt",
      bioPlaceholder: "Câteva rânduri despre tine…",
      optional: "(opțional)",
    },
    photos: {
      title: "Adaugă pozele",
      hint: "Maxim 6 poze. Prima este principală.",
      add: "Adaugă poză",
      main: "Principală",
      remove: "Șterge poza",
      terms: "Am citit și accept",
      termsLink: "Termenii",
      privacyLink: "Confidențialitatea",
      communityLink: "Regulile Comunității",
      termsAnd: "și",
      termsConfirm: ". Confirm că am cel puțin 18 ani.",
      tooMany: "Maxim 6 poze.",
      tooBig: "{{name}} depășește 8MB.",
      rejected: "Poză respinsă: {{reason}}.",
      rejectedDefault: "conținut nepermis pe profilul public",
      pending: "Poză adăugată — verificare manuală în curs",
      pendingDesc: "Va fi vizibilă public după ce un moderator o aprobă.",
      uploadFailed: "Încărcarea a eșuat",
    },
    prompts: {
      title: "3 prompts în cuvintele tale",
      choose: "Alege un prompt…",
      answer: "Răspunsul tău…",
    },
    done: {
      title: "Aproape gata",
      hint: "Activează notificările ca să afli imediat când ai un match nou sau un mesaj. Mod discret implicit — nimeni nu vede preview-ul.",
      skip: "Continuă fără notificări",
    },
    toast: {
      ready: "Profilul tău e gata.",
    },
  },


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

export async function setLanguage(lng: "ro" | "en") {
  await i18n.changeLanguage(lng);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
    try {
      window.localStorage.setItem("vz-lang", lng);
    } catch {
      /* storage blocked */
    }
  }
  // Persist to the user's profile so viewers in other countries auto-translate
  // this account's public text to their own language.
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user?.id) {
      await supabase
        .from("profiles")
        .update({ preferred_language: lng })
        .eq("id", auth.user.id);
    }
  } catch {
    /* offline / not signed in — best effort */
  }
}

