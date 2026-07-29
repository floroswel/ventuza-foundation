// Localizare emailuri Suzeta. Sursa autoritativă pentru toate șirurile
// afișate în emailurile auth. Dacă adaugi un template nou, adaugă și
// blocul corespunzător aici pentru fiecare limbă suportată.

export type EmailLocale = 'ro' | 'en'

export const DEFAULT_LOCALE: EmailLocale = 'ro'

export function normalizeLocale(input: unknown): EmailLocale {
  const s = String(input ?? '').toLowerCase().slice(0, 2)
  if (s === 'en') return 'en'
  return 'ro'
}

interface Common {
  tagline: string
  footerLocation: string
  fallbackLink: string
  ignoreFooter: string
}

interface SignupStrings {
  preview: (site: string) => string
  heading: string
  body: (site: string) => string
  cta: string
  ignore: (site: string) => string
}

interface RecoveryStrings {
  preview: (site: string) => string
  heading: string
  body: (site: string) => string
  cta: string
  ignore: string
}

interface MagicStrings {
  preview: (site: string) => string
  heading: string
  body: (site: string) => string
  cta: string
  ignore: string
}

interface InviteStrings {
  preview: (site: string) => string
  heading: string
  bodyPrefix: string
  bodySuffix: string
  cta: string
  ignore: string
}

interface EmailChangeStrings {
  preview: (site: string) => string
  heading: string
  bodyPrefix: (site: string) => string
  bodyConnector: string
  cta: string
  ignore: string
}

interface ReauthStrings {
  preview: string
  heading: string
  body: string
  ignore: string
}

export interface EmailStrings {
  common: Common
  signup: SignupStrings
  recovery: RecoveryStrings
  magicLink: MagicStrings
  invite: InviteStrings
  emailChange: EmailChangeStrings
  reauthentication: ReauthStrings
  subjects: Record<
    'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'reauthentication',
    string
  >
}

const ro: EmailStrings = {
  common: {
    tagline: 'Dating, elevated.',
    footerLocation: 'Bucharest, RO',
    fallbackLink: 'Sau copiază acest link în browser:',
    ignoreFooter: '',
  },
  signup: {
    preview: (site) => `Confirmă-ți contul ${site} — un singur pas.`,
    heading: 'Bine ai venit.',
    body: (site) =>
      `Mulțumim că ți-ai creat cont pe ${site}. Pentru a-ți activa profilul și a începe să întâlnești oameni cu care rezonezi, confirmă adresa ta de email:`,
    cta: 'Confirmă adresa de email',
    ignore: (site) =>
      `Dacă nu ai creat un cont pe ${site}, poți ignora acest email fără griji — nu se va întâmpla nimic.`,
  },
  recovery: {
    preview: (site) => `Resetare parolă ${site}`,
    heading: 'Resetează-ți parola',
    body: (site) =>
      `Am primit o cerere de resetare a parolei contului tău ${site}. Apasă butonul de mai jos pentru a alege o parolă nouă. Link-ul este valabil o oră.`,
    cta: 'Resetează parola',
    ignore:
      'Dacă nu ai cerut resetarea parolei, ignoră acest email — parola ta rămâne neschimbată. Pentru siguranță suplimentară, activează autentificarea în doi pași din setările contului.',
  },
  magicLink: {
    preview: (site) => `Link-ul tău de conectare ${site}`,
    heading: 'Conectare rapidă',
    body: (site) =>
      `Apasă butonul de mai jos pentru a te conecta la ${site}. Link-ul expiră în scurt timp și poate fi folosit o singură dată.`,
    cta: 'Conectează-mă',
    ignore: 'Dacă nu ai cerut acest link, ignoră emailul.',
  },
  invite: {
    preview: (site) => `Ești invitat pe ${site}`,
    heading: 'Ai fost invitat.',
    bodyPrefix: 'Cineva te-a invitat să te alături comunității ',
    bodySuffix: '. Acceptă invitația pentru a-ți crea contul și a începe.',
    cta: 'Acceptă invitația',
    ignore: 'Dacă nu ai așteptat o invitație, ignoră acest email.',
  },
  emailChange: {
    preview: (site) => `Confirmă schimbarea adresei de email pentru ${site}`,
    heading: 'Confirmă adresa nouă de email',
    bodyPrefix: (site) =>
      `Ai cerut schimbarea adresei de email a contului ${site} de la `,
    bodyConnector: ' la ',
    cta: 'Confirmă schimbarea',
    ignore:
      'Dacă nu tu ai cerut această schimbare, securizează-ți contul imediat din setări.',
  },
  reauthentication: {
    preview: 'Codul tău de verificare',
    heading: 'Cod de verificare',
    body: 'Folosește codul de mai jos pentru a confirma identitatea ta:',
    ignore:
      'Codul expiră în scurt timp. Dacă nu ai cerut această verificare, ignoră emailul și schimbă-ți parola.',
  },
  subjects: {
    signup: 'Confirmă-ți contul Suzeta',
    invite: 'Ești invitat pe Suzeta',
    magiclink: 'Link-ul tău de conectare Suzeta',
    recovery: 'Resetare parolă Suzeta',
    email_change: 'Confirmă noua ta adresă de email',
    reauthentication: 'Codul tău de verificare Suzeta',
  },
}

const en: EmailStrings = {
  common: {
    tagline: 'Dating, elevated.',
    footerLocation: 'Bucharest, RO',
    fallbackLink: 'Or copy this link into your browser:',
    ignoreFooter: '',
  },
  signup: {
    preview: (site) => `Confirm your ${site} account — one click.`,
    heading: 'Welcome.',
    body: (site) =>
      `Thanks for creating your ${site} account. To activate your profile and start meeting people you'll click with, confirm your email address:`,
    cta: 'Confirm my email',
    ignore: (site) =>
      `If you didn't create a ${site} account, feel free to ignore this email — nothing will happen.`,
  },
  recovery: {
    preview: (site) => `Reset your ${site} password`,
    heading: 'Reset your password',
    body: (site) =>
      `We received a request to reset the password for your ${site} account. Tap the button below to choose a new one. The link is valid for one hour.`,
    cta: 'Reset password',
    ignore:
      "If you didn't request a password reset, ignore this email — your password stays the same. For extra safety, enable two-factor authentication in account settings.",
  },
  magicLink: {
    preview: (site) => `Your ${site} sign-in link`,
    heading: 'Quick sign-in',
    body: (site) =>
      `Tap the button below to sign in to ${site}. The link expires shortly and can be used only once.`,
    cta: 'Sign me in',
    ignore: "If you didn't request this link, ignore this email.",
  },
  invite: {
    preview: (site) => `You're invited to ${site}`,
    heading: "You're invited.",
    bodyPrefix: 'Someone invited you to join ',
    bodySuffix: ". Accept the invitation to create your account and get started.",
    cta: 'Accept invitation',
    ignore: "If you weren't expecting an invitation, ignore this email.",
  },
  emailChange: {
    preview: (site) => `Confirm your new email for ${site}`,
    heading: 'Confirm your new email',
    bodyPrefix: (site) =>
      `You requested to change the email on your ${site} account from `,
    bodyConnector: ' to ',
    cta: 'Confirm change',
    ignore:
      "If you didn't request this change, secure your account immediately from settings.",
  },
  reauthentication: {
    preview: 'Your verification code',
    heading: 'Verification code',
    body: 'Use the code below to confirm your identity:',
    ignore:
      "This code expires shortly. If you didn't request this verification, ignore this email and change your password.",
  },
  subjects: {
    signup: 'Confirm your Suzeta account',
    invite: "You're invited to Suzeta",
    magiclink: 'Your Suzeta sign-in link',
    recovery: 'Reset your Suzeta password',
    email_change: 'Confirm your new email',
    reauthentication: 'Your Suzeta verification code',
  },
}

const DICTIONARIES: Record<EmailLocale, EmailStrings> = { ro, en }

export function getEmailStrings(locale: EmailLocale | string | null | undefined): EmailStrings {
  return DICTIONARIES[normalizeLocale(locale)]
}
