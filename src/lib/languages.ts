// Limbi suportate pentru traducerea mesajelor de chat.
// Codurile sunt ISO 639-1 lowercase. Ordinea = ordinea din meniu.

export type LangCode = string;

export const CHAT_TARGET_LANGS: { code: LangCode; label: string; native: string }[] = [
  { code: "ro", label: "Română", native: "Română" },
  { code: "en", label: "Engleză", native: "English" },
  { code: "es", label: "Spaniolă", native: "Español" },
  { code: "fr", label: "Franceză", native: "Français" },
  { code: "de", label: "Germană", native: "Deutsch" },
  { code: "it", label: "Italiană", native: "Italiano" },
  { code: "pt", label: "Portugheză", native: "Português" },
  { code: "nl", label: "Olandeză", native: "Nederlands" },
  { code: "pl", label: "Poloneză", native: "Polski" },
  { code: "hu", label: "Maghiară", native: "Magyar" },
  { code: "cs", label: "Cehă", native: "Čeština" },
  { code: "sk", label: "Slovacă", native: "Slovenčina" },
  { code: "el", label: "Greacă", native: "Ελληνικά" },
  { code: "tr", label: "Turcă", native: "Türkçe" },
  { code: "ru", label: "Rusă", native: "Русский" },
  { code: "uk", label: "Ucraineană", native: "Українська" },
  { code: "bg", label: "Bulgară", native: "Български" },
  { code: "sr", label: "Sârbă", native: "Srpski" },
  { code: "hr", label: "Croată", native: "Hrvatski" },
  { code: "ar", label: "Arabă", native: "العربية" },
  { code: "he", label: "Ebraică", native: "עברית" },
  { code: "fa", label: "Persană", native: "فارسی" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "zh", label: "Chineză", native: "中文" },
  { code: "ja", label: "Japoneză", native: "日本語" },
  { code: "ko", label: "Coreeană", native: "한국어" },
  { code: "vi", label: "Vietnameză", native: "Tiếng Việt" },
  { code: "th", label: "Thailandeză", native: "ไทย" },
  { code: "id", label: "Indoneziană", native: "Bahasa Indonesia" },
];

const LANG_LABEL_MAP: Record<string, { label: string; native: string }> = Object.fromEntries(
  CHAT_TARGET_LANGS.map((l) => [l.code, { label: l.label, native: l.native }]),
);

export function langLabel(code: string | null | undefined): string {
  if (!code) return "necunoscut";
  const c = code.toLowerCase().slice(0, 2);
  return LANG_LABEL_MAP[c]?.native ?? code.toUpperCase();
}

const STORAGE_KEY = "chat.translate.target";

export function detectDeviceLang(): LangCode {
  if (typeof navigator === "undefined") return "ro";
  const nav = navigator;
  const raw =
    (nav.languages && nav.languages[0]) || nav.language || (nav as { userLanguage?: string }).userLanguage || "ro";
  const code = String(raw).toLowerCase().split(/[-_]/)[0];
  if (LANG_LABEL_MAP[code]) return code;
  return "en";
}

export function loadPreferredTargetLang(): LangCode {
  if (typeof window === "undefined") return "ro";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && LANG_LABEL_MAP[saved]) return saved;
  } catch {
    /* ignore */
  }
  return detectDeviceLang();
}

export function savePreferredTargetLang(code: LangCode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}
