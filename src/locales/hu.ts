import type { PartialDict } from "./types";

/** Traducere parțială — cheile lipsă cad automat pe engleză (fallbackLng). */
const hu: PartialDict = {
  "common": {
    "cancel": "Mégse",
    "save": "Mentés",
    "delete": "Törlés",
    "confirm": "Megerősítés",
    "close": "Bezárás",
    "loading": "Betöltés…",
    "error": "Hiba",
    "back": "Vissza",
    "next": "Tovább",
    "yes": "Igen",
    "no": "Nem",
    "search": "Keresés",
    "settings": "Beállítások",
    "profile": "Profil",
    "messages": "Üzenetek",
    "discover": "Felfedezés",
    "favorites": "Kedvencek",
    "notifications": "Értesítések"
  },
  "age": {
    "title": "Erősítsd meg az életkorod",
    "desc": "A közösség biztonsága érdekében meg kell erősítened, hogy elmúltál 18 éves.",
    "cta": "Életkor ellenőrzése",
    "opening": "Megnyitás…",
    "pending": "Ellenőrzés folyamatban…",
    "resume": "Ellenőrzés folytatása",
    "failed": "Az előző ellenőrzés sikertelen volt. Próbáld újra.",
    "check": "Kész — státusz ellenőrzése"
  },
  "quickExit": {
    "label": "Gyors kilépés"
  },
  "language": {
    "title": "Nyelv",
    "auto": "Automatikusan felismerve"
  },
  "auth": {
    "back": "← Vissza",
    "createAccount": "Hozd létre a fiókod",
    "welcomeBack": "Üdv újra",
    "tabLogin": "Bejelentkezés",
    "tabSignup": "Regisztráció",
    "orEmail": "vagy e-maillel",
    "email": "E-mail",
    "emailPlaceholder": "te@domain.com",
    "password": "Jelszó",
    "passwordPlaceholderSignup": "Legalább 8 karakter",
    "passwordPlaceholderLogin": "A jelszavad",
    "showPassword": "Jelszó mutatása",
    "hidePassword": "Jelszó elrejtése",
    "forgot": "Elfelejtetted a jelszót?",
    "birthdate": "Születési dátum",
    "minAge": "Legalább 18 évesnek kell lenned.",
    "over18": "Megerősítem, hogy <1>18 éves vagy idősebb</1> vagyok.",
    "acceptTerms": "Elfogadom a <1>Feltételeket</1> és az <3>Adatvédelmi tájékoztatót</3>.",
    "submitSignup": "Fiók létrehozása",
    "submitLogin": "Bejelentkezés",
    "retryIn": "Várj {{s}}mp",
    "haveAccount": "Van már fiókod?",
    "noAccount": "Még nincs fiókod?",
    "switchLogin": "Bejelentkezés",
    "switchSignup": "Regisztráció",
    "footer": "A folytatással elfogadod a <1>Feltételeket</1> és az <3>Adatvédelmi tájékoztatót</3>.",
    "resend": "E-mail újraküldése",
    "retryCountdown": "{{s}}mp múlva újra próbálhatod.",
    "errors": {
      "confirmChecks": "Pipáld ki mindkét jelölőnégyzetet (18+ és Feltételek).",
      "needBirthdate": "Add meg a születési dátumod a folytatás előtt.",
      "tooYoung": "Legalább 18 évesnek kell lenned a Suzeta használatához.",
      "welcome": "Üdv a Suzetán.",
      "invalidEmail": "Adj meg egy érvényes e-mail-címet.",
      "passwordMin": "A jelszónak legalább 8 karakternek kell lennie.",
      "passwordMax": "A jelszó legfeljebb 72 karakter lehet.",
      "enterEmailFirst": "Először add meg fent az e-mail-címed.",
      "resetSent": "Jelszó-visszaállító link elküldve.",
      "passwordsDontMatch": "A jelszavak nem egyeznek.",
      "passwordUpdated": "Jelszó frissítve.",
      "missingEmailBack": "Hiányzik az e-mail-cím — lépj vissza a regisztrációhoz.",
      "resendSent": "Elküldve. Nézd meg a postaládád és a spam mappát."
    },
    "resetPassword": {
      "title": "Válassz új jelszót",
      "subtitle": "Adj meg egy új jelszót a fiókodhoz.",
      "validating": "A link ellenőrzése…",
      "newPassword": "Új jelszó",
      "confirm": "Jelszó megerősítése",
      "submit": "Jelszó frissítése"
    },
    "checkEmail": {
      "pageTitle": "Nézd meg az e-mailed",
      "sentLink": "Küldtünk egy megerősítő linket",
      "sentLinkTo": "ide:",
      "openToActivate": "Nyisd meg a fiók aktiválásához.",
      "spamHint": "Nem látod? Nézd meg a spam / promóciók mappát.",
      "resendIn": "Újraküldés {{s}}mp múlva",
      "resend": "E-mail újraküldése",
      "backToLogin": "Vissza a bejelentkezéshez"
    }
  },
  "authErrors": {
    "captchaMissing": "Hiányzik a robotellenőrzés.",
    "captchaFailed": "A robotellenőrzés sikertelen.",
    "rateLimited": "Túl sok próbálkozás. Várj {{s}} másodpercet.",
    "emailNotConfirmed": "Az e-mail nincs megerősítve.",
    "invalidCredentials": "Hibás e-mail vagy jelszó.",
    "userAlreadyExists": "Ezzel az e-maillel már létezik fiók.",
    "weakPassword": "Túl gyenge jelszó.",
    "samePassword": "Az új jelszó megegyezik a régivel.",
    "emailInvalid": "Ez az e-mail nem tűnik érvényesnek.",
    "emailBounced": "Nem sikerült e-mailt kézbesíteni erre a címre.",
    "disposableEmail": "Eldobható e-mail nem engedélyezett.",
    "ageRequired": "Ellenőrizned kell az életkorod.",
    "signupDisabled": "A regisztráció jelenleg zárva.",
    "sessionExpired": "A munkamenet lejárt.",
    "network": "Instabil kapcsolat.",
    "unknown": "Valami hiba történt."
  },
  "notif": {
    "title": "Értesítések",
    "markAllRead": "Összes megjelölése olvasottként",
    "emptyTitle": "Még nincs értesítés.",
    "emptyDesc": "Szólunk, ha történik valami érdekes."
  },
  "cookies": {
    "intro": "Alapvető sütiket használunk a belépéshez és a biztonsághoz. A hozzájárulásoddal névtelen analitikát és marketingmérést is hozzáadunk.",
    "details": "Részletek",
    "reject": "Elutasítás",
    "customize": "Testreszabás",
    "acceptAll": "Összes elfogadása",
    "pickTitle": "Válaszd ki, mit engedélyezel",
    "essential": "Alapvető",
    "essentialDesc": "Belépés, munkamenet, biztonság. Kötelező.",
    "analytics": "Analitika",
    "analyticsDesc": "Névtelen használati statisztikák.",
    "marketing": "Marketing",
    "marketingDesc": "Kampánymérés és ajánlások.",
    "back": "Vissza",
    "save": "Mentés",
    "ariaLabel": "Süti beállítások"
  },
  "landing": {
    "badge": "18+ · Prémium társkeresés",
    "tagline": "Társkeresés magasabb szinten. Ismerj meg olyanokat, akik tényleg passzolnak hozzád.",
    "createAccount": "Fiók létrehozása",
    "login": "Bejelentkezés",
    "terms": "Feltételek",
    "privacy": "Adatvédelem",
    "footer": "A folytatással elfogadod a <1>Feltételeket</1> és az <3>Adatvédelmi tájékoztatót</3>.",
    "b2bTitle": "B2B partnereknek",
    "b2bSubtitle": "Helyszínek · események · ajánlatok partnereknek",
    "safety": "Biztonság és segítség"
  }
} as PartialDict;

export default hu;
