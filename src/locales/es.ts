import type { PartialDict } from "./types";

/** Traducere parțială — cheile lipsă cad automat pe engleză (fallbackLng). */
const es: PartialDict = {
  "common": {
    "cancel": "Cancelar",
    "save": "Guardar",
    "delete": "Eliminar",
    "confirm": "Confirmar",
    "close": "Cerrar",
    "loading": "Cargando…",
    "error": "Error",
    "back": "Atrás",
    "next": "Siguiente",
    "yes": "Sí",
    "no": "No",
    "search": "Buscar",
    "settings": "Ajustes",
    "profile": "Perfil",
    "messages": "Mensajes",
    "discover": "Descubrir",
    "favorites": "Favoritos",
    "notifications": "Notificaciones"
  },
  "age": {
    "title": "Confirma tu edad",
    "desc": "Por la seguridad de la comunidad, debes confirmar que eres mayor de 18 años.",
    "cta": "Verificar edad",
    "opening": "Abriendo…",
    "pending": "Verificación en curso…",
    "resume": "Reanudar verificación",
    "failed": "La verificación anterior falló. Inténtalo de nuevo.",
    "check": "He terminado — comprobar estado"
  },
  "quickExit": {
    "label": "Salida rápida"
  },
  "language": {
    "title": "Idioma",
    "auto": "Detectado automáticamente"
  },
  "auth": {
    "back": "← Atrás",
    "createAccount": "Crea tu cuenta",
    "welcomeBack": "Bienvenido de nuevo",
    "tabLogin": "Iniciar sesión",
    "tabSignup": "Registrarse",
    "orEmail": "o con email",
    "email": "Email",
    "emailPlaceholder": "tu@dominio.com",
    "password": "Contraseña",
    "passwordPlaceholderSignup": "Mínimo 8 caracteres",
    "passwordPlaceholderLogin": "Tu contraseña",
    "showPassword": "Mostrar contraseña",
    "hidePassword": "Ocultar contraseña",
    "forgot": "¿Olvidaste tu contraseña?",
    "birthdate": "Fecha de nacimiento",
    "minAge": "Debes tener al menos 18 años.",
    "over18": "Confirmo que tengo <1>18 años o más</1>.",
    "acceptTerms": "Acepto los <1>Términos</1> y la <3>Política de privacidad</3>.",
    "submitSignup": "Crear cuenta",
    "submitLogin": "Iniciar sesión",
    "retryIn": "Espera {{s}}s",
    "haveAccount": "¿Ya tienes cuenta?",
    "noAccount": "¿Aún no tienes cuenta?",
    "switchLogin": "Iniciar sesión",
    "switchSignup": "Registrarse",
    "footer": "Al continuar aceptas nuestros <1>Términos</1> y la <3>Política de privacidad</3>.",
    "resend": "Reenviar email",
    "retryCountdown": "Puedes reintentar en {{s}}s.",
    "errors": {
      "confirmChecks": "Marca las dos casillas (18+ y Términos) antes de continuar.",
      "needBirthdate": "Introduce tu fecha de nacimiento antes de continuar.",
      "tooYoung": "Debes tener al menos 18 años para usar Suzeta.",
      "welcome": "Bienvenido a Suzeta.",
      "invalidEmail": "Introduce un email válido.",
      "passwordMin": "La contraseña debe tener al menos 8 caracteres.",
      "passwordMax": "La contraseña puede tener como máximo 72 caracteres.",
      "enterEmailFirst": "Introduce primero tu email arriba.",
      "resetSent": "Enlace de restablecimiento enviado.",
      "passwordsDontMatch": "Las contraseñas no coinciden.",
      "passwordUpdated": "Contraseña actualizada.",
      "missingEmailBack": "Falta la dirección de email — vuelve al paso de registro.",
      "resendSent": "Enviado. Revisa tu bandeja y la carpeta de spam."
    },
    "resetPassword": {
      "title": "Elige una nueva contraseña",
      "subtitle": "Introduce una nueva contraseña para tu cuenta.",
      "validating": "Validando tu enlace…",
      "newPassword": "Nueva contraseña",
      "confirm": "Confirmar contraseña",
      "submit": "Actualizar contraseña"
    },
    "checkEmail": {
      "pageTitle": "Revisa tu email",
      "sentLink": "Te hemos enviado un enlace de confirmación",
      "sentLinkTo": "a",
      "openToActivate": "Ábrelo para activar tu cuenta.",
      "spamHint": "¿No lo ves? Revisa spam o promociones.",
      "resendIn": "Reenviar en {{s}}s",
      "resend": "Reenviar email",
      "backToLogin": "Volver al inicio de sesión"
    }
  },
  "authErrors": {
    "captchaMissing": "Falta la verificación anti-bot.",
    "captchaFailed": "La verificación anti-bot falló.",
    "rateLimited": "Demasiados intentos. Espera {{s}} segundos.",
    "emailNotConfirmed": "Email no confirmado.",
    "invalidCredentials": "Email o contraseña incorrectos.",
    "userAlreadyExists": "Ya existe una cuenta con este email.",
    "weakPassword": "Contraseña demasiado débil.",
    "samePassword": "La nueva contraseña es idéntica a la anterior.",
    "emailInvalid": "Este email no parece válido.",
    "emailBounced": "No pudimos entregar un email a esta dirección.",
    "disposableEmail": "Email desechable no permitido.",
    "ageRequired": "Necesitas verificar tu edad.",
    "signupDisabled": "Los registros están cerrados por ahora.",
    "sessionExpired": "Sesión caducada.",
    "network": "Conexión inestable.",
    "unknown": "Algo salió mal."
  },
  "notif": {
    "title": "Notificaciones",
    "markAllRead": "Marcar todo como leído",
    "emptyTitle": "Aún no hay notificaciones.",
    "emptyDesc": "Te avisaremos cuando pase algo interesante."
  },
  "cookies": {
    "intro": "Usamos cookies esenciales para la autenticación y la seguridad. Con tu consentimiento añadimos analítica anónima y medición de marketing.",
    "details": "Detalles",
    "reject": "Rechazar",
    "customize": "Personalizar",
    "acceptAll": "Aceptar todo",
    "pickTitle": "Elige qué permites",
    "essential": "Esenciales",
    "essentialDesc": "Acceso, sesión, seguridad. Obligatorias.",
    "analytics": "Analítica",
    "analyticsDesc": "Estadísticas de uso anónimas.",
    "marketing": "Marketing",
    "marketingDesc": "Medición de campañas y recomendaciones.",
    "back": "Atrás",
    "save": "Guardar",
    "ariaLabel": "Ajustes de cookies"
  },
  "landing": {
    "badge": "18+ · Citas premium",
    "tagline": "Citas de otro nivel. Conoce a gente que encaja de verdad contigo.",
    "createAccount": "Crear cuenta",
    "login": "Iniciar sesión",
    "terms": "Términos",
    "privacy": "Privacidad",
    "footer": "Al continuar aceptas nuestros <1>Términos</1> y la <3>Política de privacidad</3>.",
    "b2bTitle": "Para socios B2B",
    "b2bSubtitle": "Locales · eventos · ofertas para socios",
    "safety": "Seguridad y recursos"
  }
} as PartialDict;

export default es;
