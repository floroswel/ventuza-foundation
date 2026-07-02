import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile wrapper (GDPR-friendly, cookieless).
 *
 * - Site key citit din `import.meta.env.VITE_TURNSTILE_SITE_KEY`.
 * - Dacă site key lipsește (dev local fără config), componenta randează nimic
 *   și apelantul tratează `token=null` (vezi `isTurnstileConfigured`).
 * - Cheia secretă NU trăiește în client — se setează în Supabase Auth Dashboard
 *   (Bot protection → Turnstile). Supabase validează automat `captchaToken`
 *   în `signUp` / `signInWithPassword` / `resetPasswordForEmail`.
 */

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

export function isTurnstileConfigured(): boolean {
  return SITE_KEY.length > 0;
}

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
