import type { PartialDict } from "./types";

/** Traducere parțială — cheile lipsă cad automat pe engleză (fallbackLng). */
const pt: PartialDict = {
  "common": {
    "cancel": "Cancelar",
    "save": "Guardar",
    "delete": "Eliminar",
    "confirm": "Confirmar",
    "close": "Fechar",
    "loading": "A carregar…",
    "error": "Erro",
    "back": "Voltar",
    "next": "Seguinte",
    "yes": "Sim",
    "no": "Não",
    "search": "Pesquisar",
    "settings": "Definições",
    "profile": "Perfil",
    "messages": "Mensagens",
    "discover": "Descobrir",
    "favorites": "Favoritos",
    "notifications": "Notificações"
  },
  "age": {
    "title": "Confirma a tua idade",
    "desc": "Para a segurança da comunidade, tens de confirmar que tens mais de 18 anos.",
    "cta": "Verificar idade",
    "opening": "A abrir…",
    "pending": "Verificação em curso…",
    "resume": "Retomar verificação",
    "failed": "A verificação anterior falhou. Tenta novamente.",
    "check": "Terminei — verificar estado"
  },
  "quickExit": {
    "label": "Saída rápida"
  },
  "language": {
    "title": "Idioma",
    "auto": "Detetado automaticamente"
  },
  "auth": {
    "back": "← Voltar",
    "createAccount": "Cria a tua conta",
    "welcomeBack": "Bem-vindo de volta",
    "tabLogin": "Entrar",
    "tabSignup": "Registar",
    "orEmail": "ou com email",
    "email": "Email",
    "emailPlaceholder": "tu@dominio.com",
    "password": "Palavra-passe",
    "passwordPlaceholderSignup": "Mínimo 8 caracteres",
    "passwordPlaceholderLogin": "A tua palavra-passe",
    "showPassword": "Mostrar palavra-passe",
    "hidePassword": "Ocultar palavra-passe",
    "forgot": "Esqueceste a palavra-passe?",
    "birthdate": "Data de nascimento",
    "minAge": "Tens de ter pelo menos 18 anos.",
    "over18": "Confirmo que tenho <1>18 anos ou mais</1>.",
    "acceptTerms": "Aceito os <1>Termos</1> e a <3>Política de Privacidade</3>.",
    "submitSignup": "Criar conta",
    "submitLogin": "Entrar",
    "retryIn": "Aguarda {{s}}s",
    "haveAccount": "Já tens conta?",
    "noAccount": "Ainda não tens conta?",
    "switchLogin": "Entrar",
    "switchSignup": "Registar",
    "footer": "Ao continuar aceitas os nossos <1>Termos</1> e a <3>Política de Privacidade</3>.",
    "resend": "Reenviar email",
    "retryCountdown": "Podes tentar de novo em {{s}}s.",
    "errors": {
      "confirmChecks": "Marca as duas caixas (18+ e Termos) antes de continuar.",
      "needBirthdate": "Introduz a tua data de nascimento antes de continuar.",
      "tooYoung": "Tens de ter pelo menos 18 anos para usar a Suzeta.",
      "welcome": "Bem-vindo à Suzeta.",
      "invalidEmail": "Introduz um email válido.",
      "passwordMin": "A palavra-passe tem de ter pelo menos 8 caracteres.",
      "passwordMax": "A palavra-passe pode ter no máximo 72 caracteres.",
      "enterEmailFirst": "Introduz primeiro o teu email acima.",
      "resetSent": "Link de reposição enviado.",
      "passwordsDontMatch": "As palavras-passe não coincidem.",
      "passwordUpdated": "Palavra-passe atualizada.",
      "missingEmailBack": "Falta o endereço de email — volta ao passo de registo.",
      "resendSent": "Enviado. Verifica a caixa de entrada e o spam."
    },
    "resetPassword": {
      "title": "Escolhe uma nova palavra-passe",
      "subtitle": "Introduz uma nova palavra-passe para a tua conta.",
      "validating": "A validar o teu link…",
      "newPassword": "Nova palavra-passe",
      "confirm": "Confirmar palavra-passe",
      "submit": "Atualizar palavra-passe"
    },
    "checkEmail": {
      "pageTitle": "Verifica o teu email",
      "sentLink": "Enviámos-te um link de confirmação",
      "sentLinkTo": "para",
      "openToActivate": "Abre-o para ativar a tua conta.",
      "spamHint": "Não vês? Verifica spam / promoções.",
      "resendIn": "Reenviar em {{s}}s",
      "resend": "Reenviar email",
      "backToLogin": "Voltar ao início de sessão"
    }
  },
  "authErrors": {
    "captchaMissing": "Falta a verificação anti-bot.",
    "captchaFailed": "A verificação anti-bot falhou.",
    "rateLimited": "Demasiadas tentativas. Aguarda {{s}} segundos.",
    "emailNotConfirmed": "Email não confirmado.",
    "invalidCredentials": "Email ou palavra-passe incorretos.",
    "userAlreadyExists": "Já existe uma conta com este email.",
    "weakPassword": "Palavra-passe demasiado fraca.",
    "samePassword": "A nova palavra-passe é igual à anterior.",
    "emailInvalid": "Este email não parece válido.",
    "emailBounced": "Não conseguimos entregar um email neste endereço.",
    "disposableEmail": "Email descartável não permitido.",
    "ageRequired": "Precisas de verificar a tua idade.",
    "signupDisabled": "Os registos estão fechados de momento.",
    "sessionExpired": "Sessão expirada.",
    "network": "Ligação instável.",
    "unknown": "Algo correu mal."
  },
  "notif": {
    "title": "Notificações",
    "markAllRead": "Marcar tudo como lido",
    "emptyTitle": "Ainda sem notificações.",
    "emptyDesc": "Avisamos-te quando acontecer algo interessante."
  },
  "cookies": {
    "intro": "Usamos cookies essenciais para autenticação e segurança. Com o teu consentimento juntamos análises anónimas e medição de marketing.",
    "details": "Detalhes",
    "reject": "Rejeitar",
    "customize": "Personalizar",
    "acceptAll": "Aceitar tudo",
    "pickTitle": "Escolhe o que permites",
    "essential": "Essenciais",
    "essentialDesc": "Início de sessão, sessão, segurança. Obrigatórios.",
    "analytics": "Análise",
    "analyticsDesc": "Estatísticas de utilização anónimas.",
    "marketing": "Marketing",
    "marketingDesc": "Medição de campanhas e recomendações.",
    "back": "Voltar",
    "save": "Guardar",
    "ariaLabel": "Definições de cookies"
  },
  "landing": {
    "badge": "18+ · Encontros premium",
    "tagline": "Encontros com outro nível. Conhece pessoas que combinam mesmo contigo.",
    "createAccount": "Criar conta",
    "login": "Entrar",
    "terms": "Termos",
    "privacy": "Privacidade",
    "footer": "Ao continuar aceitas os nossos <1>Termos</1> e a <3>Política de Privacidade</3>.",
    "b2bTitle": "Para parceiros B2B",
    "b2bSubtitle": "Locais · eventos · ofertas para parceiros",
    "safety": "Segurança e recursos"
  }
} as PartialDict;

export default pt;
