import type { PartialDict } from "./types";

/** Traducere parțială — cheile lipsă cad automat pe engleză (fallbackLng). */
const nl: PartialDict = {
  "common": {
    "cancel": "Annuleren",
    "save": "Opslaan",
    "delete": "Verwijderen",
    "confirm": "Bevestigen",
    "close": "Sluiten",
    "loading": "Laden…",
    "error": "Fout",
    "back": "Terug",
    "next": "Volgende",
    "yes": "Ja",
    "no": "Nee",
    "search": "Zoeken",
    "settings": "Instellingen",
    "profile": "Profiel",
    "messages": "Berichten",
    "discover": "Ontdekken",
    "favorites": "Favorieten",
    "notifications": "Meldingen"
  },
  "age": {
    "title": "Bevestig je leeftijd",
    "desc": "Voor de veiligheid van de community moet je bevestigen dat je 18+ bent.",
    "cta": "Leeftijd verifiëren",
    "opening": "Openen…",
    "pending": "Verificatie loopt…",
    "resume": "Verificatie hervatten",
    "failed": "De vorige verificatie is mislukt. Probeer opnieuw.",
    "check": "Klaar — status controleren"
  },
  "quickExit": {
    "label": "Snel afsluiten"
  },
  "language": {
    "title": "Taal",
    "auto": "Automatisch gedetecteerd"
  },
  "auth": {
    "back": "← Terug",
    "createAccount": "Maak je account",
    "welcomeBack": "Welkom terug",
    "tabLogin": "Inloggen",
    "tabSignup": "Registreren",
    "orEmail": "of met e-mail",
    "email": "E-mail",
    "emailPlaceholder": "jij@domein.com",
    "password": "Wachtwoord",
    "passwordPlaceholderSignup": "Minimaal 8 tekens",
    "passwordPlaceholderLogin": "Je wachtwoord",
    "showPassword": "Wachtwoord tonen",
    "hidePassword": "Wachtwoord verbergen",
    "forgot": "Wachtwoord vergeten?",
    "birthdate": "Geboortedatum",
    "minAge": "Je moet minstens 18 zijn.",
    "over18": "Ik bevestig dat ik <1>18 jaar of ouder</1> ben.",
    "acceptTerms": "Ik ga akkoord met de <1>Voorwaarden</1> en het <3>Privacybeleid</3>.",
    "submitSignup": "Account aanmaken",
    "submitLogin": "Inloggen",
    "retryIn": "Wacht {{s}}s",
    "haveAccount": "Al lid?",
    "noAccount": "Nog geen account?",
    "switchLogin": "Inloggen",
    "switchSignup": "Registreren",
    "footer": "Door verder te gaan ga je akkoord met onze <1>Voorwaarden</1> en ons <3>Privacybeleid</3>.",
    "resend": "E-mail opnieuw sturen",
    "retryCountdown": "Je kunt het over {{s}}s opnieuw proberen.",
    "errors": {
      "confirmChecks": "Vink beide vakjes aan (18+ en Voorwaarden) voordat je verdergaat.",
      "needBirthdate": "Vul je geboortedatum in voordat je verdergaat.",
      "tooYoung": "Je moet minstens 18 zijn om Suzeta te gebruiken.",
      "welcome": "Welkom bij Suzeta.",
      "invalidEmail": "Vul een geldig e-mailadres in.",
      "passwordMin": "Het wachtwoord moet minstens 8 tekens hebben.",
      "passwordMax": "Het wachtwoord mag maximaal 72 tekens hebben.",
      "enterEmailFirst": "Vul eerst hierboven je e-mailadres in.",
      "resetSent": "Link om je wachtwoord te resetten verstuurd.",
      "passwordsDontMatch": "De wachtwoorden komen niet overeen.",
      "passwordUpdated": "Wachtwoord bijgewerkt.",
      "missingEmailBack": "E-mailadres ontbreekt — ga terug naar de registratiestap.",
      "resendSent": "Verstuurd. Check je inbox en spamfolder."
    },
    "resetPassword": {
      "title": "Kies een nieuw wachtwoord",
      "subtitle": "Vul een nieuw wachtwoord in voor je account.",
      "validating": "Je link wordt gecontroleerd…",
      "newPassword": "Nieuw wachtwoord",
      "confirm": "Bevestig wachtwoord",
      "submit": "Wachtwoord bijwerken"
    },
    "checkEmail": {
      "pageTitle": "Check je e-mail",
      "sentLink": "We hebben je een bevestigingslink gestuurd",
      "sentLinkTo": "naar",
      "openToActivate": "Open hem om je account te activeren.",
      "spamHint": "Niets ontvangen? Check spam / reclame.",
      "resendIn": "Opnieuw sturen over {{s}}s",
      "resend": "E-mail opnieuw sturen",
      "backToLogin": "Terug naar inloggen"
    }
  },
  "authErrors": {
    "captchaMissing": "Anti-botcontrole ontbreekt.",
    "captchaFailed": "Anti-botcontrole mislukt.",
    "rateLimited": "Te veel pogingen. Wacht {{s}} seconden.",
    "emailNotConfirmed": "E-mail niet bevestigd.",
    "invalidCredentials": "Onjuist e-mailadres of wachtwoord.",
    "userAlreadyExists": "Er bestaat al een account met dit e-mailadres.",
    "weakPassword": "Wachtwoord te zwak.",
    "samePassword": "Het nieuwe wachtwoord is hetzelfde als het oude.",
    "emailInvalid": "Dit e-mailadres lijkt ongeldig.",
    "emailBounced": "We konden geen e-mail bezorgen op dit adres.",
    "disposableEmail": "Wegwerp-e-mail niet toegestaan.",
    "ageRequired": "Je moet je leeftijd verifiëren.",
    "signupDisabled": "Registraties zijn momenteel gesloten.",
    "sessionExpired": "Sessie verlopen.",
    "network": "Instabiele verbinding.",
    "unknown": "Er ging iets mis."
  },
  "notif": {
    "title": "Meldingen",
    "markAllRead": "Alles als gelezen markeren",
    "emptyTitle": "Nog geen meldingen.",
    "emptyDesc": "We laten het weten zodra er iets gebeurt."
  },
  "cookies": {
    "intro": "We gebruiken essentiële cookies voor login en veiligheid. Met jouw toestemming voegen we anonieme statistieken en marketingmetingen toe.",
    "details": "Details",
    "reject": "Weigeren",
    "customize": "Aanpassen",
    "acceptAll": "Alles accepteren",
    "pickTitle": "Kies wat je toestaat",
    "essential": "Essentieel",
    "essentialDesc": "Login, sessie, beveiliging. Verplicht.",
    "analytics": "Statistieken",
    "analyticsDesc": "Anonieme gebruiksstatistieken.",
    "marketing": "Marketing",
    "marketingDesc": "Campagnemetingen en aanbevelingen.",
    "back": "Terug",
    "save": "Opslaan",
    "ariaLabel": "Cookie-instellingen"
  },
  "landing": {
    "badge": "18+ · Premium dating",
    "tagline": "Daten op niveau. Ontmoet mensen die echt bij je passen.",
    "createAccount": "Account aanmaken",
    "login": "Inloggen",
    "terms": "Voorwaarden",
    "privacy": "Privacy",
    "footer": "Door verder te gaan ga je akkoord met onze <1>Voorwaarden</1> en ons <3>Privacybeleid</3>.",
    "b2bTitle": "Voor B2B-partners",
    "b2bSubtitle": "Locaties · events · aanbiedingen voor partners",
    "safety": "Veiligheid & hulp"
  }
} as PartialDict;

export default nl;
