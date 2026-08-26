import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TurnstileWidget, isTurnstileConfigured } from "@/components/TurnstileWidget";
import { translateAuthError, type FriendlyAuthError } from "@/lib/auth-errors";
import { oauthOrigin } from "@/lib/canonical-origin";

const searchSchema = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/auth_/check-email")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Confirmă emailul — Suzeta" }, { name: "robots", content: "noindex" }],
  }),
  component: CheckEmailPage,
});

function CheckEmailPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const [email, setEmail] = useState<string | undefined>(search.email);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [resendError, setResendError] = useState<FriendlyAuthError | null>(null);
  const captchaRequired = isTurnstileConfigured();

  useEffect(() => {
    if (email) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function handleError(err: unknown) {
    const mapped = translateAuthError(t, err);
    setResendError(mapped);
    if (mapped.retryAfterSec) setCooldown(mapped.retryAfterSec);
    if (mapped.resetCaptcha) {
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
    }
    toast.error(mapped.message, { description: mapped.action, duration: mapped.retryAfterSec && mapped.retryAfterSec > 30 ? 8000 : 5500 });
  }

  async function resend() {
    if (!email) {
      toast.error(t("auth.errors.missingEmailBack"));
      return;
    }
    if (captchaRequired && !captchaToken) {
      handleError(new Error("captcha required"));
      return;
    }
    setResending(true);
    setResendError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${oauthOrigin()}/n`,
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (error) throw error;
      toast.success(t("auth.errors.resendSent"));
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
      setCooldown(60);
    } catch (e) {
      handleError(e);
    } finally {
      setResending(false);
    }
  }

  const disabled = resending || cooldown > 0 || !email || (captchaRequired && !captchaToken);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center space-y-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">{t("auth.checkEmail.pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.checkEmail.sentLink")}{" "}
          {email ? (
            <>
              {t("auth.checkEmail.sentLinkTo")}{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : (
            "."
          )}{" "}
          {t("auth.checkEmail.openToActivate")}
        </p>
        <p className="text-xs text-muted-foreground">{t("auth.checkEmail.spamHint")}</p>
        <TurnstileWidget
          key={captchaNonce}
          onToken={(tok) => {
            setCaptchaToken(tok);
            if (resendError?.resetCaptcha) setResendError(null);
          }}
          onExpire={() => setCaptchaToken(null)}
        />
        {resendError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive"
          >
            {resendError.message}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={resend} disabled={disabled}>
            {resending && <Loader2 className="size-4 animate-spin mr-2" />}
            {cooldown > 0
              ? t("auth.checkEmail.resendIn", { s: cooldown })
              : t("auth.checkEmail.resend")}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth" search={{ mode: "login" }}>
              {t("auth.checkEmail.backToLogin")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
