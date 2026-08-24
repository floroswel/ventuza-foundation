import type { PartialDict } from "./types";

/** Traducere parțială — cheile lipsă cad automat pe engleză (fallbackLng). */
const pl: PartialDict = {
  "common": {
    "cancel": "Anuluj",
    "save": "Zapisz",
    "delete": "Usuń",
    "confirm": "Potwierdź",
    "close": "Zamknij",
    "loading": "Ładowanie…",
    "error": "Błąd",
    "back": "Wstecz",
    "next": "Dalej",
    "yes": "Tak",
    "no": "Nie",
    "search": "Szukaj",
    "settings": "Ustawienia",
    "profile": "Profil",
    "messages": "Wiadomości",
    "discover": "Odkrywaj",
    "favorites": "Ulubione",
    "notifications": "Powiadomienia"
  },
  "age": {
    "title": "Potwierdź swój wiek",
    "desc": "Dla bezpieczeństwa społeczności musisz potwierdzić, że masz ukończone 18 lat.",
    "cta": "Zweryfikuj wiek",
    "opening": "Otwieranie…",
    "pending": "Weryfikacja w toku…",
    "resume": "Wznów weryfikację",
    "failed": "Poprzednia weryfikacja się nie powiodła. Spróbuj ponownie.",
    "check": "Gotowe — sprawdź status"
  },
  "quickExit": {
    "label": "Szybkie wyjście"
  },
  "language": {
    "title": "Język",
    "auto": "Wykryty automatycznie"
  },
  "auth": {
    "back": "← Wstecz",
    "createAccount": "Załóż konto",
    "welcomeBack": "Witaj ponownie",
    "tabLogin": "Zaloguj się",
    "tabSignup": "Rejestracja",
    "orEmail": "lub przez e-mail",
    "email": "E-mail",
    "emailPlaceholder": "ty@domena.com",
    "password": "Hasło",
    "passwordPlaceholderSignup": "Minimum 8 znaków",
    "passwordPlaceholderLogin": "Twoje hasło",
    "showPassword": "Pokaż hasło",
    "hidePassword": "Ukryj hasło",
    "forgot": "Nie pamiętasz hasła?",
    "birthdate": "Data urodzenia",
    "minAge": "Musisz mieć co najmniej 18 lat.",
    "over18": "Potwierdzam, że mam <1>18 lat lub więcej</1>.",
    "acceptTerms": "Akceptuję <1>Regulamin</1> i <3>Politykę prywatności</3>.",
    "submitSignup": "Załóż konto",
    "submitLogin": "Zaloguj się",
    "retryIn": "Poczekaj {{s}}s",
    "haveAccount": "Masz już konto?",
    "noAccount": "Nie masz jeszcze konta?",
    "switchLogin": "Zaloguj się",
    "switchSignup": "Zarejestruj się",
    "footer": "Kontynuując, akceptujesz nasz <1>Regulamin</1> i <3>Politykę prywatności</3>.",
    "resend": "Wyślij e-mail ponownie",
    "retryCountdown": "Możesz spróbować ponownie za {{s}}s.",
    "errors": {
      "confirmChecks": "Zaznacz oba pola (18+ i Regulamin), zanim przejdziesz dalej.",
      "needBirthdate": "Podaj datę urodzenia, zanim przejdziesz dalej.",
      "tooYoung": "Musisz mieć co najmniej 18 lat, aby korzystać z Suzeta.",
      "welcome": "Witamy w Suzeta.",
      "invalidEmail": "Podaj prawidłowy adres e-mail.",
      "passwordMin": "Hasło musi mieć co najmniej 8 znaków.",
      "passwordMax": "Hasło może mieć maksymalnie 72 znaki.",
      "enterEmailFirst": "Najpierw podaj powyżej swój e-mail.",
      "resetSent": "Link do zresetowania hasła wysłany.",
      "passwordsDontMatch": "Hasła nie są takie same.",
      "passwordUpdated": "Hasło zaktualizowane.",
      "missingEmailBack": "Brak adresu e-mail — wróć do kroku rejestracji.",
      "resendSent": "Wysłano. Sprawdź skrzynkę i folder spam."
    },
    "resetPassword": {
      "title": "Wybierz nowe hasło",
      "subtitle": "Podaj nowe hasło do swojego konta.",
      "validating": "Sprawdzamy Twój link…",
      "newPassword": "Nowe hasło",
      "confirm": "Potwierdź hasło",
      "submit": "Zaktualizuj hasło"
    },
    "checkEmail": {
      "pageTitle": "Sprawdź e-mail",
      "sentLink": "Wysłaliśmy Ci link potwierdzający",
      "sentLinkTo": "na",
      "openToActivate": "Otwórz go, aby aktywować konto.",
      "spamHint": "Nie widzisz? Sprawdź folder spam / oferty.",
      "resendIn": "Wyślij ponownie za {{s}}s",
      "resend": "Wyślij e-mail ponownie",
      "backToLogin": "Wróć do logowania"
    }
  },
  "authErrors": {
    "captchaMissing": "Brak weryfikacji anty-bot.",
    "captchaFailed": "Weryfikacja anty-bot nie powiodła się.",
    "rateLimited": "Zbyt wiele prób. Poczekaj {{s}} sekund.",
    "emailNotConfirmed": "E-mail niepotwierdzony.",
    "invalidCredentials": "Nieprawidłowy e-mail lub hasło.",
    "userAlreadyExists": "Konto z tym adresem e-mail już istnieje.",
    "weakPassword": "Hasło zbyt słabe.",
    "samePassword": "Nowe hasło jest takie samo jak poprzednie.",
    "emailInvalid": "Ten e-mail wygląda na nieprawidłowy.",
    "emailBounced": "Nie udało się dostarczyć wiadomości na ten adres.",
    "disposableEmail": "Jednorazowy e-mail jest niedozwolony.",
    "ageRequired": "Musisz zweryfikować swój wiek.",
    "signupDisabled": "Rejestracje są obecnie zamknięte.",
    "sessionExpired": "Sesja wygasła.",
    "network": "Niestabilne połączenie.",
    "unknown": "Coś poszło nie tak."
  },
  "notif": {
    "title": "Powiadomienia",
    "markAllRead": "Oznacz wszystkie jako przeczytane",
    "emptyTitle": "Brak powiadomień.",
    "emptyDesc": "Damy znać, gdy wydarzy się coś ciekawego."
  },
  "cookies": {
    "intro": "Używamy niezbędnych plików cookie do logowania i bezpieczeństwa. Za Twoją zgodą dodajemy anonimowe statystyki i pomiary marketingowe.",
    "details": "Szczegóły",
    "reject": "Odrzuć",
    "customize": "Dostosuj",
    "acceptAll": "Akceptuj wszystko",
    "pickTitle": "Wybierz, na co się zgadzasz",
    "essential": "Niezbędne",
    "essentialDesc": "Logowanie, sesja, bezpieczeństwo. Wymagane.",
    "analytics": "Analityka",
    "analyticsDesc": "Anonimowe statystyki użycia.",
    "marketing": "Marketing",
    "marketingDesc": "Pomiary kampanii i rekomendacje.",
    "back": "Wstecz",
    "save": "Zapisz",
    "ariaLabel": "Ustawienia plików cookie"
  },
  "landing": {
    "badge": "18+ · Randki premium",
    "tagline": "Randki na wyższym poziomie. Poznawaj ludzi, którzy naprawdę do Ciebie pasują.",
    "createAccount": "Załóż konto",
    "login": "Zaloguj się",
    "terms": "Regulamin",
    "privacy": "Prywatność",
    "footer": "Kontynuując, akceptujesz nasz <1>Regulamin</1> i <3>Politykę prywatności</3>.",
    "b2bTitle": "Dla partnerów B2B",
    "b2bSubtitle": "Lokale · wydarzenia · oferty dla partnerów",
    "safety": "Bezpieczeństwo i pomoc"
  }
} as PartialDict;

export default pl;
