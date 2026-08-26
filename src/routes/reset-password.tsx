import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showAuthErrorToast } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Resetare parolă — Suzeta" },
      { name: "description", content: "Alege în siguranță o parolă nouă pentru contul Suzeta." },
      { property: "og:title", content: "Resetare parolă — Suzeta" },
      { property: "og:description", content: "Alege în siguranță o parolă nouă pentru contul Suzeta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

const passwordSchema = z.string().min(8, "password_min").max(72, "password_max");

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setInvalidLink(true);
    }, 8_000);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        window.clearTimeout(timeout);
        setReady(true);
        setInvalidLink(false);
      }
    });
    const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
    const recovery = tokenHash
      ? supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : supabase.auth.getSession();
    void recovery.then(({ data, error }) => {
      if (!active) return;
      if (error) {
        window.clearTimeout(timeout);
        setInvalidLink(true);
        return;
      }
      if ("session" in data && data.session) {
        window.clearTimeout(timeout);
        setReady(true);
        setInvalidLink(false);
        if (tokenHash) window.history.replaceState({}, "", "/reset-password");
      }
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      return toast.error(
        t(code === "password_max" ? "auth.errors.passwordMax" : "auth.errors.passwordMin"),
      );
    }
    if (password !== confirm) return toast.error(t("auth.errors.passwordsDontMatch"));
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setSubmitting(false);
    if (error) {
      showAuthErrorToast(t, error);
      return;
    }
    toast.success(t("auth.errors.passwordUpdated"));
    navigate({ to: "/discover", replace: true });
  }

  return (
    <main className="relative min-h-dvh bg-background px-6 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="wordmark text-4xl font-medium">Suzeta</h1>
        <h2 className="mt-6 text-xl font-medium">{t("auth.resetPassword.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {ready ? t("auth.resetPassword.subtitle") : t("auth.resetPassword.validating")}
        </p>

        {invalidLink && !ready && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-sm text-foreground">
              Linkul de resetare a expirat sau a fost deja folosit. Cere un link nou din ecranul de autentificare.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/auth", replace: true })}>
              Înapoi la autentificare
            </Button>
          </div>
        )}

        {ready && (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="pw"
                className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
              >
                {t("auth.resetPassword.newPassword")}
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw"
                  type="password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="pw2"
                className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
              >
                {t("auth.resetPassword.confirm")}
              </Label>
              <Input
                id="pw2"
                type="password"
                minLength={8}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-full text-sm uppercase tracking-[0.18em]"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("auth.resetPassword.submit")
              )}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
