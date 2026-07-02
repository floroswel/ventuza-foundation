import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TurnstileWidget, isTurnstileConfigured } from "@/components/TurnstileWidget";
import { mapAuthError, type FriendlyAuthError } from "@/lib/auth-errors";

const searchSchema = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/auth/check-email")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Confirmă emailul — Ventuza" }, { name: "robots", content: "noindex" }],
  }),
  component: CheckEmailPage,
});

function CheckEmailPage() {
  const { email } = Route.useSearch();
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [resendError, setResendError] = useState<FriendlyAuthError | null>(null);
  const captchaRequired = isTurnstileConfigured();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleError(err: unknown) {
    const mapped = mapAuthError(err);
    setResendError(mapped);
    if (mapped.retryAfterSec) setCooldown(mapped.retryAfterSec);
    if (mapped.resetCaptcha) {
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
    }
    toast.error(mapped.message);
  }

  async function resend() {
    if (!email) {
      toast.error("Lipsește adresa de email — întoarce-te la pasul de înregistrare.");
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
          emailRedirectTo: `${window.location.origin}/n`,
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (error) throw error;
      toast.success("Trimis. Verifică inbox + spam.");
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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center space-y-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Verifică-ți emailul</h1>
        <p className="text-sm text-muted-foreground">
          Ți-am trimis un link de confirmare{" "}
          {email ? (
            <>
              la <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : (
            "."
          )}{" "}
          Deschide-l pentru a-ți activa contul.
        </p>
        <p className="text-xs text-muted-foreground">
          Nu vezi emailul? Verifică folderul Spam / Promoții.
        </p>
        <TurnstileWidget
          key={captchaNonce}
          onToken={(t) => {
            setCaptchaToken(t);
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
            {cooldown > 0 ? `Retrimite în ${cooldown}s` : "Retrimite emailul"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth" search={{ mode: "login" }}>
              Înapoi la autentificare
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
