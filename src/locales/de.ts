import type { PartialDict } from "./types";

/** Traducere parțială — cheile lipsă cad automat pe engleză (fallbackLng). */
const de: PartialDict = {
  "common": {
    "cancel": "Abbrechen",
    "save": "Speichern",
    "delete": "Löschen",
    "confirm": "Bestätigen",
    "close": "Schließen",
    "loading": "Wird geladen…",
    "error": "Fehler",
    "back": "Zurück",
    "next": "Weiter",
    "yes": "Ja",
    "no": "Nein",
    "search": "Suchen",
    "settings": "Einstellungen",
    "profile": "Profil",
    "messages": "Nachrichten",
    "discover": "Entdecken",
    "favorites": "Favoriten",
    "notifications": "Mitteilungen"
  },
  "age": {
    "title": "Bestätige dein Alter",
    "desc": "Zur Sicherheit der Community musst du bestätigen, dass du über 18 bist.",
    "cta": "Alter prüfen",
    "opening": "Wird geöffnet…",
    "pending": "Prüfung läuft…",
    "resume": "Prüfung fortsetzen",
    "failed": "Die letzte Prüfung ist fehlgeschlagen. Bitte erneut versuchen.",
    "check": "Fertig — Status prüfen"
  },
  "quickExit": {
    "label": "Schnell verlassen"
  },
  "language": {
    "title": "Sprache",
    "auto": "Automatisch erkannt"
  },
  "auth": {
    "back": "← Zurück",
    "createAccount": "Konto erstellen",
    "welcomeBack": "Willkommen zurück",
    "tabLogin": "Anmelden",
    "tabSignup": "Registrieren",
    "orEmail": "oder mit E-Mail",
    "email": "E-Mail",
    "emailPlaceholder": "du@domain.com",
    "password": "Passwort",
    "passwordPlaceholderSignup": "Mindestens 8 Zeichen",
    "passwordPlaceholderLogin": "Dein Passwort",
    "showPassword": "Passwort anzeigen",
    "hidePassword": "Passwort verbergen",
    "forgot": "Passwort vergessen?",
    "birthdate": "Geburtsdatum",
    "minAge": "Du musst mindestens 18 sein.",
    "over18": "Ich bestätige, dass ich <1>18 Jahre oder älter</1> bin.",
    "acceptTerms": "Ich akzeptiere die <1>AGB</1> und die <3>Datenschutzerklärung</3>.",
    "submitSignup": "Konto erstellen",
    "submitLogin": "Anmelden",
    "retryIn": "Warte {{s}}s",
    "haveAccount": "Schon Mitglied?",
    "noAccount": "Noch kein Konto?",
    "switchLogin": "Anmelden",
    "switchSignup": "Registrieren",
    "footer": "Mit dem Fortfahren akzeptierst du unsere <1>AGB</1> und <3>Datenschutzerklärung</3>.",
    "resend": "E-Mail erneut senden",
    "retryCountdown": "Du kannst es in {{s}}s erneut versuchen.",
    "errors": {
      "confirmChecks": "Bitte bestätige beide Kästchen (18+ und AGB).",
      "needBirthdate": "Gib dein Geburtsdatum ein, bevor du fortfährst.",
      "tooYoung": "Du musst mindestens 18 Jahre alt sein, um Suzeta zu nutzen.",
      "welcome": "Willkommen bei Suzeta.",
      "invalidEmail": "Gib eine gültige E-Mail-Adresse ein.",
      "passwordMin": "Das Passwort muss mindestens 8 Zeichen haben.",
      "passwordMax": "Das Passwort darf höchstens 72 Zeichen haben.",
      "enterEmailFirst": "Gib zuerst oben deine E-Mail-Adresse ein.",
      "resetSent": "Link zum Zurücksetzen des Passworts gesendet.",
      "passwordsDontMatch": "Die Passwörter stimmen nicht überein.",
      "passwordUpdated": "Passwort aktualisiert.",
      "missingEmailBack": "E-Mail-Adresse fehlt — gehe zurück zur Registrierung.",
      "resendSent": "Gesendet. Prüfe Posteingang und Spam-Ordner."
    },
    "resetPassword": {
      "title": "Neues Passwort wählen",
      "subtitle": "Gib ein neues Passwort für dein Konto ein.",
      "validating": "Dein Link wird geprüft…",
      "newPassword": "Neues Passwort",
      "confirm": "Passwort bestätigen",
      "submit": "Passwort aktualisieren"
    },
    "checkEmail": {
      "pageTitle": "Prüfe deine E-Mails",
      "sentLink": "Wir haben dir einen Bestätigungslink gesendet",
      "sentLinkTo": "an",
      "openToActivate": "Öffne ihn, um dein Konto zu aktivieren.",
      "spamHint": "Nichts erhalten? Prüfe den Spam-Ordner.",
      "resendIn": "Erneut senden in {{s}}s",
      "resend": "E-Mail erneut senden",
      "backToLogin": "Zurück zur Anmeldung"
    }
  },
  "authErrors": {
    "captchaMissing": "Anti-Bot-Prüfung fehlt.",
    "captchaFailed": "Anti-Bot-Prüfung fehlgeschlagen.",
    "rateLimited": "Zu viele Versuche. Warte {{s}} Sekunden.",
    "emailNotConfirmed": "E-Mail nicht bestätigt.",
    "invalidCredentials": "E-Mail oder Passwort falsch.",
    "userAlreadyExists": "Es existiert bereits ein Konto mit dieser E-Mail.",
    "weakPassword": "Passwort zu schwach.",
    "samePassword": "Das neue Passwort ist identisch mit dem alten.",
    "emailInvalid": "Diese E-Mail sieht ungültig aus.",
    "emailBounced": "Wir konnten keine E-Mail an diese Adresse zustellen.",
    "disposableEmail": "Wegwerf-E-Mail nicht erlaubt.",
    "ageRequired": "Du musst dein Alter bestätigen.",
    "signupDisabled": "Registrierungen sind derzeit geschlossen.",
    "sessionExpired": "Sitzung abgelaufen.",
    "network": "Instabile Verbindung.",
    "unknown": "Etwas ist schiefgelaufen."
  },
  "notif": {
    "title": "Mitteilungen",
    "markAllRead": "Alle als gelesen markieren",
    "emptyTitle": "Noch keine Mitteilungen.",
    "emptyDesc": "Wir melden uns, sobald etwas Interessantes passiert."
  },
  "cookies": {
    "intro": "Wir verwenden notwendige Cookies für Anmeldung und Sicherheit. Mit deiner Zustimmung kommen anonyme Analysen und Marketing-Messungen hinzu.",
    "details": "Details",
    "reject": "Ablehnen",
    "customize": "Anpassen",
    "acceptAll": "Alle akzeptieren",
    "pickTitle": "Wähle, was du erlaubst",
    "essential": "Notwendig",
    "essentialDesc": "Anmeldung, Sitzung, Sicherheit. Erforderlich.",
    "analytics": "Analyse",
    "analyticsDesc": "Anonyme Nutzungsstatistiken.",
    "marketing": "Marketing",
    "marketingDesc": "Kampagnenmessung und Empfehlungen.",
    "back": "Zurück",
    "save": "Speichern",
    "ariaLabel": "Cookie-Einstellungen"
  },
  "landing": {
    "badge": "18+ · Premium-Dating",
    "tagline": "Dating auf einem neuen Niveau. Triff Menschen, die zu dir passen.",
    "createAccount": "Konto erstellen",
    "login": "Anmelden",
    "terms": "AGB",
    "privacy": "Datenschutz",
    "footer": "Mit dem Fortfahren akzeptierst du unsere <1>AGB</1> und <3>Datenschutzerklärung</3>.",
    "b2bTitle": "Für B2B-Partner",
    "b2bSubtitle": "Locations · Events · Angebote für Partner",
    "safety": "Sicherheit & Hilfe"
  }
} as PartialDict;

export default de;
