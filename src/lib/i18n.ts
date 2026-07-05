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
  auth: {
    back: "← Înapoi",
    tagline: "Ventuza",
    createAccount: "Creează-ți contul",
    welcomeBack: "Bine ai revenit",
    tabLogin: "Autentificare",
    tabSignup: "Înregistrare",
    continueGoogle: "Continuă cu Google",
    continueApple: "Continuă cu Apple",
    orEmail: "sau cu email",
    email: "Email",
    emailPlaceholder: "tu@domeniu.com",
    password: "Parolă",
    passwordPlaceholderSignup: "Minim 8 caractere",
    passwordPlaceholderLogin: "Parola ta",
    showPassword: "Arată parola",
    hidePassword: "Ascunde parola",
    forgot: "Ai uitat parola?",
    birthdate: "Data nașterii",
    minAge: "Trebuie să ai cel puțin 18 ani.",
    over18: "Confirm că am <1>18 ani sau mai mult</1>.",
    acceptTerms: "Sunt de acord cu <1>Termenii</1> și <3>Politica de confidențialitate</3>.",
    submitSignup: "Creează cont",
    submitLogin: "Autentifică-te",
    retryIn: "Așteaptă {{s}}s",
    haveAccount: "Ai deja cont?",
    noAccount: "Nu ai cont încă?",
    switchLogin: "Autentifică-te",
    switchSignup: "Înregistrează-te",
    footer: "Continuând, ești de acord cu <1>Termenii</1> și <3>Politica de confidențialitate</3>.",
    resend: "Retrimite emailul",
    retryCountdown: "Mai poți încerca în {{s}}s.",
    errors: {
      confirmChecks: "Confirmă cele două bife (18+ și Termeni) înainte de a continua.",
      needBirthdate: "Introdu data nașterii înainte de a continua.",
      needBirthdateOAuth: "Introdu data nașterii înainte de a continua cu Google/Apple.",
      tooYoung: "Trebuie să ai cel puțin 18 ani pentru a folosi Ventuza.",
      welcome: "Bun venit pe Ventuza.",
    },
  },
  cookies: {
    intro:
      "Folosim cookie-uri esențiale pentru autentificare și siguranță. Cu acordul tău, adăugăm analytics anonime și măsurători de marketing pentru îmbunătățirea aplicației.",
    details: "Detalii",
    reject: "Refuz",
    customize: "Personalizează",
    acceptAll: "Accept tot",
    pickTitle: "Alege ce permiți",
    essential: "Esențiale",
    essentialDesc: "Login, sesiune, securitate. Necesare.",
    analytics: "Analytics",
    analyticsDesc: "Statistici anonime de utilizare.",
    marketing: "Marketing",
    marketingDesc: "Măsurători campanii și recomandări.",
    back: "Înapoi",
    save: "Salvează",
    ariaLabel: "Setări cookie-uri",
  },
  landing: {
    badge: "18+ · Dating premium",
    tagline: "Dating, la alt nivel. Cunoaște oameni pe măsura ta — nu doar a swipe-ului tău.",
    createAccount: "Creează cont",
    login: "Autentificare",
    terms: "Termeni",
    privacy: "Politica de confidențialitate",
    footer: "Continuând, ești de acord cu <1>Termenii</1> și <3>Politica de confidențialitate</3>.",
    b2bTitle: "Pentru parteneri B2B",
    b2bSubtitle: "Locuri · evenimente · oferte",
    safety: "Siguranță & resurse",
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
  auth: {
    back: "← Back",
    tagline: "Ventuza",
    createAccount: "Create your account",
    welcomeBack: "Welcome back",
    tabLogin: "Log in",
    tabSignup: "Sign up",
    continueGoogle: "Continue with Google",
    continueApple: "Continue with Apple",
    orEmail: "or with email",
    email: "Email",
    emailPlaceholder: "you@domain.com",
    password: "Password",
    passwordPlaceholderSignup: "At least 8 characters",
    passwordPlaceholderLogin: "Your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    forgot: "Forgot password?",
    birthdate: "Birthdate",
    minAge: "You must be at least 18.",
    over18: "I confirm I am <1>18 years or older</1>.",
    acceptTerms: "I accept the <1>Terms</1> & <3>Privacy Policy</3>.",
    submitSignup: "Create account",
    submitLogin: "Log in",
    retryIn: "Wait {{s}}s",
    haveAccount: "Already a member?",
    noAccount: "No account yet?",
    switchLogin: "Log in",
    switchSignup: "Sign up",
    footer: "By continuing you agree to our <1>Terms</1> and <3>Privacy Policy</3>.",
    resend: "Resend email",
    retryCountdown: "You can retry in {{s}}s.",
    errors: {
      confirmChecks: "Please confirm both checkboxes (18+ and Terms) before continuing.",
      needBirthdate: "Enter your birthdate before continuing.",
      needBirthdateOAuth: "Enter your birthdate before continuing with Google/Apple.",
      tooYoung: "You must be at least 18 to use Ventuza.",
      welcome: "Welcome to Ventuza.",
    },
  },
  cookies: {
    intro:
      "We use essential cookies for authentication and safety. With your consent, we add anonymous analytics and marketing measurements to improve the app.",
    details: "Details",
    reject: "Reject",
    customize: "Customize",
    acceptAll: "Accept all",
    pickTitle: "Choose what you allow",
    essential: "Essential",
    essentialDesc: "Login, session, security. Required.",
    analytics: "Analytics",
    analyticsDesc: "Anonymous usage statistics.",
    marketing: "Marketing",
    marketingDesc: "Campaign measurements and recommendations.",
    back: "Back",
    save: "Save",
    ariaLabel: "Cookie settings",
  },
  landing: {
    badge: "18+ · Premium dating",
    tagline: "Dating, elevated. Meet people who match your depth — not just your swipe.",
    createAccount: "Create account",
    login: "Log in",
    terms: "Terms",
    privacy: "Privacy Policy",
    footer: "By continuing you agree to our <1>Terms</1> and <3>Privacy Policy</3>.",
    b2bTitle: "For B2B partners",
    b2bSubtitle: "Venues · events · offers",
    safety: "Safety & resources",
  },

  onboarding: {
    back: "Back",
    continue: "Continue",
    finish: "Finish",
    stepLabel: "{{name}} · {{n}}/{{total}}",
    step: {
      basics: "About you",
      identity: "Identity",
      intent: "What you're looking for",
      stats: "Physical",
      personality: "Personality",
      photos: "Photos",
    },
    basics: {
      title: "Let's get to know you",
      hint: "Your name and birthdate. You must be 18+.",
      nameLabel: "What's your name?",
      namePlaceholder: "Your name",
      birthLabel: "Birthdate",
      birthLocked: "We took your birthdate from sign-up. Contact support to change it.",
      minAge: "You must be at least 18.",
    },
    identity: {
      title: "Your identity",
      hint: "Gender, pronouns and orientation. Pick anything that fits.",
      gender: "Gender",
      genderCustom: "Custom (optional)",
      pronouns: "Pronouns",
      pronounsCustom: "e.g. ze/zir (optional)",
      orientation: "Orientation",
    },
    intent: {
      title: "What are you looking for?",
      hint: "Pick anything that fits. Tribes are optional.",
      looking: "Looking for",
      tribes: "Tribes",
      optional: "(optional)",
    },
    stats: {
      title: "Your physical profile",
      hint: "Everything is optional. Show only what you want.",
      body: "Body type",
      position: "Position",
      height: "Height (cm)",
      weight: "Weight (kg)",
      ethnicity: "Ethnicity",
      relationship: "Relationship status",
    },
    personality: {
      title: "Who you are",
      hint: "Interests and a short bio.",
      interests: "Interests",
      min3: "(min. 3)",
      bio: "Short bio",
      bioPlaceholder: "A few lines about you…",
      optional: "(optional)",
    },
    photos: {
      title: "Add your photos",
      hint: "Up to 6 photos. First one is primary.",
      add: "Add photo",
      main: "Main",
      remove: "Remove photo",
      terms: "I've read and accept the",
      termsLink: "Terms",
      privacyLink: "Privacy",
      communityLink: "Community Rules",
      termsAnd: "and",
      termsConfirm: ". I confirm I'm at least 18.",
      tooMany: "Max 6 photos.",
      tooBig: "{{name}} exceeds 8MB.",
      rejected: "Photo rejected: {{reason}}.",
      rejectedDefault: "content not allowed on a public profile",
      pending: "Photo added — manual review in progress",
      pendingDesc: "It will be publicly visible after a moderator approves it.",
      uploadFailed: "Upload failed",
    },
    prompts: {
      title: "3 prompts in your own words",
      choose: "Pick a prompt…",
      answer: "Your answer…",
    },
    done: {
      title: "Almost there",
      hint: "Turn on notifications so you know instantly when you have a new match or message. Discreet mode by default — no preview.",
      skip: "Continue without notifications",
    },
    toast: {
      ready: "Your profile is ready.",
    },
  },
};


// Smart fallback map: when the device locale isn't a fully-translated shell
// language, pick the closest sibling instead of dropping to English blindly.
// Keeps the UI in a SINGLE language (no ro+en mixing on the same screen).
//   - md (Moldovan) → ro (same language, different ISO code)
//   - Romance/Germanic/Slavic without a translation → en
//   - anything else → en
// When we add a full translation later (e.g. de/fr), move the code into
// `supportedLngs` and drop it from this map.
const SMART_FALLBACKS: Record<string, string[]> = {
  md: ["ro", "en"],
  "ro-md": ["ro", "en"],
  default: ["en"],
};

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { ro: { translation: ro }, en: { translation: en } },
      // Object form → per-language fallback chain. i18next walks the chain
      // until it finds a resource, so we never render half-translated screens.
      fallbackLng: SMART_FALLBACKS,
      supportedLngs: ["ro", "en"],
      // Match "en-US"/"en-GB" → "en", "ro-RO" → "ro" so region variants of a
      // supported language don't get pushed to the default fallback.
      nonExplicitSupportedLngs: true,
      load: "languageOnly",

      interpolation: { escapeValue: false },
      detection: {
        // First launch: read navigator.language (browser locale from OS).
        // We intentionally DROP `htmlTag` from the chain — SSR renders
        // <html lang="ro"> as a sensible default, but if we include htmlTag
        // here, any browser locale that isn't in supportedLngs (e.g. de-DE,
        // fr-FR, ja-JP) short-circuits to "ro" instead of hitting the
        // fallback chain, and non-Romanian users are stuck in Romanian.
        // Without htmlTag, unsupported locales fall through to fallbackLng
        // (→ "en"), which is what we want.
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "vz-lang",
        caches: ["localStorage"],
      },

    })
    .then(() => {
      if (typeof document !== "undefined") {
        document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language ?? "en";
      }
    });

  // Keep <html lang> in sync when the user switches language later.
  i18n.on("languageChanged", (lng) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lng;
    }
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

