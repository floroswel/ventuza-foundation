import type { PartialDict } from "./types";

/** Traducere parțială — cheile lipsă cad automat pe engleză (fallbackLng). */
const fr: PartialDict = {
  "common": {
    "cancel": "Annuler",
    "save": "Enregistrer",
    "delete": "Supprimer",
    "confirm": "Confirmer",
    "close": "Fermer",
    "loading": "Chargement…",
    "error": "Erreur",
    "back": "Retour",
    "next": "Suivant",
    "yes": "Oui",
    "no": "Non",
    "search": "Rechercher",
    "settings": "Paramètres",
    "profile": "Profil",
    "messages": "Messages",
    "discover": "Découvrir",
    "favorites": "Favoris",
    "notifications": "Notifications"
  },
  "age": {
    "title": "Confirme ton âge",
    "desc": "Pour la sécurité de la communauté, tu dois confirmer que tu as plus de 18 ans.",
    "cta": "Vérifier l'âge",
    "opening": "Ouverture…",
    "pending": "Vérification en cours…",
    "resume": "Reprendre la vérification",
    "failed": "La vérification précédente a échoué. Réessaie.",
    "check": "J'ai terminé — vérifier le statut"
  },
  "quickExit": {
    "label": "Sortie rapide"
  },
  "language": {
    "title": "Langue",
    "auto": "Détectée automatiquement"
  },
  "auth": {
    "back": "← Retour",
    "createAccount": "Crée ton compte",
    "welcomeBack": "Bon retour",
    "tabLogin": "Connexion",
    "tabSignup": "Inscription",
    "orEmail": "ou avec un e-mail",
    "email": "E-mail",
    "emailPlaceholder": "toi@domaine.com",
    "password": "Mot de passe",
    "passwordPlaceholderSignup": "Au moins 8 caractères",
    "passwordPlaceholderLogin": "Ton mot de passe",
    "showPassword": "Afficher le mot de passe",
    "hidePassword": "Masquer le mot de passe",
    "forgot": "Mot de passe oublié ?",
    "birthdate": "Date de naissance",
    "minAge": "Tu dois avoir au moins 18 ans.",
    "over18": "Je confirme avoir <1>18 ans ou plus</1>.",
    "acceptTerms": "J'accepte les <1>Conditions</1> et la <3>Politique de confidentialité</3>.",
    "submitSignup": "Créer un compte",
    "submitLogin": "Se connecter",
    "retryIn": "Attends {{s}}s",
    "haveAccount": "Déjà membre ?",
    "noAccount": "Pas encore de compte ?",
    "switchLogin": "Se connecter",
    "switchSignup": "S'inscrire",
    "footer": "En continuant, tu acceptes nos <1>Conditions</1> et notre <3>Politique de confidentialité</3>.",
    "resend": "Renvoyer l'e-mail",
    "retryCountdown": "Tu peux réessayer dans {{s}}s.",
    "errors": {
      "confirmChecks": "Coche les deux cases (18+ et Conditions) avant de continuer.",
      "needBirthdate": "Saisis ta date de naissance avant de continuer.",
      "tooYoung": "Tu dois avoir au moins 18 ans pour utiliser Suzeta.",
      "welcome": "Bienvenue sur Suzeta.",
      "invalidEmail": "Saisis un e-mail valide.",
      "passwordMin": "Le mot de passe doit contenir au moins 8 caractères.",
      "passwordMax": "Le mot de passe ne peut pas dépasser 72 caractères.",
      "enterEmailFirst": "Saisis d'abord ton e-mail ci-dessus.",
      "resetSent": "Lien de réinitialisation envoyé.",
      "passwordsDontMatch": "Les mots de passe ne correspondent pas.",
      "passwordUpdated": "Mot de passe mis à jour.",
      "missingEmailBack": "Adresse e-mail manquante — retourne à l'étape d'inscription.",
      "resendSent": "Envoyé. Vérifie ta boîte de réception et les spams."
    },
    "resetPassword": {
      "title": "Choisis un nouveau mot de passe",
      "subtitle": "Saisis un nouveau mot de passe pour ton compte.",
      "validating": "Validation de ton lien…",
      "newPassword": "Nouveau mot de passe",
      "confirm": "Confirme le mot de passe",
      "submit": "Mettre à jour"
    },
    "checkEmail": {
      "pageTitle": "Vérifie tes e-mails",
      "sentLink": "Nous t'avons envoyé un lien de confirmation",
      "sentLinkTo": "à",
      "openToActivate": "Ouvre-le pour activer ton compte.",
      "spamHint": "Rien reçu ? Vérifie les spams / promotions.",
      "resendIn": "Renvoyer dans {{s}}s",
      "resend": "Renvoyer l'e-mail",
      "backToLogin": "Retour à la connexion"
    }
  },
  "authErrors": {
    "captchaMissing": "Vérification anti-robot manquante.",
    "captchaFailed": "Vérification anti-robot échouée.",
    "rateLimited": "Trop de tentatives. Attends {{s}} secondes.",
    "emailNotConfirmed": "E-mail non confirmé.",
    "invalidCredentials": "E-mail ou mot de passe incorrect.",
    "userAlreadyExists": "Un compte existe déjà avec cet e-mail.",
    "weakPassword": "Mot de passe trop faible.",
    "samePassword": "Le nouveau mot de passe est identique à l'ancien.",
    "emailInvalid": "Cet e-mail ne semble pas valide.",
    "emailBounced": "Impossible de livrer un e-mail à cette adresse.",
    "disposableEmail": "E-mail jetable non autorisé.",
    "ageRequired": "Tu dois vérifier ton âge.",
    "signupDisabled": "Les inscriptions sont fermées pour le moment.",
    "sessionExpired": "Session expirée.",
    "network": "Connexion instable.",
    "unknown": "Une erreur est survenue."
  },
  "notif": {
    "title": "Notifications",
    "markAllRead": "Tout marquer comme lu",
    "emptyTitle": "Aucune notification pour l'instant.",
    "emptyDesc": "On te préviendra dès qu'il se passe quelque chose."
  },
  "cookies": {
    "intro": "Nous utilisons des cookies essentiels pour l'authentification et la sécurité. Avec ton accord, nous ajoutons des mesures anonymes d'audience et de marketing.",
    "details": "Détails",
    "reject": "Refuser",
    "customize": "Personnaliser",
    "acceptAll": "Tout accepter",
    "pickTitle": "Choisis ce que tu autorises",
    "essential": "Essentiels",
    "essentialDesc": "Connexion, session, sécurité. Obligatoires.",
    "analytics": "Statistiques",
    "analyticsDesc": "Statistiques d'usage anonymes.",
    "marketing": "Marketing",
    "marketingDesc": "Mesure des campagnes et recommandations.",
    "back": "Retour",
    "save": "Enregistrer",
    "ariaLabel": "Paramètres des cookies"
  },
  "landing": {
    "badge": "18+ · Rencontres premium",
    "tagline": "Les rencontres, en mieux. Rencontre des gens qui te correspondent vraiment.",
    "createAccount": "Créer un compte",
    "login": "Se connecter",
    "terms": "Conditions",
    "privacy": "Confidentialité",
    "footer": "En continuant, tu acceptes nos <1>Conditions</1> et notre <3>Politique de confidentialité</3>.",
    "b2bTitle": "Pour les partenaires B2B",
    "b2bSubtitle": "Lieux · événements · offres pour partenaires",
    "safety": "Sécurité & ressources"
  }
} as PartialDict;

export default fr;
