/**
 * Buton reutilizabil „Retrimite email de confirmare”.
 * Include Turnstile când e configurat, cooldown și mesaje de eroare locale.
 */
import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TurnstileWidget, isTurnstileConfigured } from "@/components/TurnstileWidget";
import { translateAuthError, type FriendlyAuthError } from "@/lib/auth-errors";
import { oauthOrigin } from "@/lib/canonical-origin";
import { logAccountFlowEvent } from "@/lib/account-flow.functions";
import { useTranslation } from "react-i18next";

export function ResendConfirmationButton({
  email,
  className,
  variant = "outline",
}: {
  email?: string | null;
  className?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const { t } = useTranslation();
  const logEvent = useServerFn(logAccountFlowEvent);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  const captchaRequired = isTurnstileConfigured();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function resend() {
    if (!email) {
      toast.error("Nu găsim adresa ta de email. Reautentifică-te și încearcă din nou.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${oauthOrigin()}/n`,
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (err) throw err;
      toast.success("Email de confirmare retrimis.");
      setCooldown(60);
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
      void logEvent({ data: { kind: "email_confirmation", stage: "resend_requested" } }).catch(
        () => {},
      );
    } catch (e) {
      const mapped = translateAuthError(t, e);
      setError(mapped);
      if (mapped.retryAfterSec) setCooldown(mapped.retryAfterSec);
      if (mapped.resetCaptcha) {
        setCaptchaToken(null);
        setCaptchaNonce((n) => n + 1);
      }
      toast.error(mapped.message, { description: mapped.action });
      void logEvent({
        data: {
          kind: "email_confirmation",
          stage: "resend_failed",
          detail: { code: mapped.code ?? "unknown" },
        },
      }).catch(() => {});
    } finally {
      setSending(false);
    }
  }

  const disabled = sending || cooldown > 0 || !email || (captchaRequired && !captchaToken);

  return (
    <div className={className}>
      {captchaRequired && (
        <TurnstileWidget
          key={captchaNonce}
          onToken={(tok) => setCaptchaToken(tok)}
          onExpire={() => setCaptchaToken(null)}
        />
      )}
      {error && (
        <div
          role="alert"
          className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive"
        >
          {error.message}
          {error.action ? <span className="block opacity-80">{error.action}</span> : null}
        </div>
      )}
      <Button
        type="button"
        variant={variant}
        className="w-full"
        onClick={() => void resend()}
        disabled={disabled}
      >
        {sending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Mail className="size-4" aria-hidden="true" />
        )}
        {cooldown > 0
          ? `Retrimite în ${cooldown}s`
          : "Retrimite email de confirmare"}
      </Button>
    </div>
  );
}
