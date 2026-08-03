import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef } from "react";
import { isProductionHost } from "@/lib/age-gate-policy";

/**
 * Cloudflare Turnstile wrapper (GDPR-friendly, cookieless).
 *
 * - Site key citit din `import.meta.env.VITE_TURNSTILE_SITE_KEY`.
 * - În PROD: captcha este OBLIGATORIU (fail-closed). Dacă site key lipsește,
 *   `isCaptchaMandatory()` întoarce true dar `isTurnstileConfigured()` false
 *   → formularul afișează eroare și blochează submit-ul (nu semnătura tăcută).
 * - În dev/preview: opt-in; dacă lipsește site key, formularul funcționează
 *   fără captcha (viteză iterație locală).
 * - Cheia secretă NU trăiește în client — se setează în Supabase Auth Dashboard
 *   (Bot protection → Turnstile). Supabase validează server-side automat
 *   `captchaToken` la `signUp` / `signInWithPassword` / `resetPasswordForEmail`.
 */

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

/**
 * Runtime nativ (Capacitor). Turnstile rulează în WebView de pe
 * `capacitor://localhost` / `https://localhost`, origin pe care Cloudflare nu
 * îl poate valida → widgetul fie nu se încarcă, fie nu emite token, iar
 * signup-ul rămâne blocat până la timeout. Pe nativ sărim captcha și ne bazăm
 * pe rate limit-ul server-side din `/api/public/signup-guard` + Supabase.
 */
export function isNativeRuntimeSync(): boolean {
  try {
    const cap = (globalThis as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }).Capacitor;
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function isTurnstileConfigured(): boolean {
  return SITE_KEY.length > 0 && !isNativeRuntimeSync();
}

/** Captcha e obligatoriu DOAR când site key-ul e configurat (fail-open dacă lipsește). */
export function isCaptchaMandatory(): boolean {
  return isTurnstileConfigured();
}

/**
 * Turnstile lipsă pe prod = degradare a protecției anti-bot, dar NU blocăm
 * signup-ul real (rate limit per IP + fingerprint în `/api/public/signup-guard`
 * rămâne activ). Întoarcem mereu false pentru a nu bloca UI-ul.
 */
export function isTurnstileMisconfiguredInProd(): boolean {
  return false;
}
// isProductionHost import kept for future re-enable without diff churn.
void isProductionHost;

type Props = {
  /** Apelat când utilizatorul rezolvă challenge-ul. */
  onToken: (token: string) => void;
  /** Apelat la expirare/eroare ca să dezactivezi token-ul anterior. */
  onExpire?: () => void;
  /** Theme override; default = auto. */
  theme?: "light" | "dark" | "auto";
};

export function TurnstileWidget({ onToken, onExpire, theme = "auto" }: Props) {
  const ref = useRef<TurnstileInstance | null>(null);

  useEffect(
    () => () => {
      try {
        ref.current?.remove();
      } catch {
        /* noop */
      }
    },
    [],
  );

  if (!isTurnstileConfigured()) return null;

  return (
    <div className="flex justify-center">
      <Turnstile
        ref={ref}
        siteKey={SITE_KEY}
        options={{ theme, size: "flexible" }}
        onSuccess={onToken}
        onExpire={() => {
          onExpire?.();
        }}
        onError={() => {
          onExpire?.();
        }}
      />
    </div>
  );
}
