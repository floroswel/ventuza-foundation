import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, Loader2, Lock, MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { translateAuthError } from "@/lib/auth-errors";

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

const MAX_CODE_ATTEMPTS = 5;

type FieldErrors = {
  password?: string;
  confirm?: string;
  code?: string;
};

function isExpiredLinkError(error: unknown) {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return (
    msg.includes("expired") ||
    msg.includes("invalid") ||
    msg.includes("not found") ||
    msg.includes("token has expired") ||
    msg.includes("otp_expired")
  );
}

function needsEmailCode(error: unknown) {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return (
    msg.includes("nonce") ||
    msg.includes("reauthentication") ||
    msg.includes("aal2 session is required") ||
    msg.includes("mfa")
  );
}

function isInvalidEmailCode(error: unknown) {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return (
    (msg.includes("nonce") &&
      (msg.includes("invalid") || msg.includes("expired") || msg.includes("incorrect"))) ||
    msg.includes("reauthentication nonce is invalid") ||
    msg.includes("reauthentication nonce has expired")
  );
}

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [linkReason, setLinkReason] = useState<"expired" | "used" | "timeout">("expired");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [codeRequired, setCodeRequired] = useState(false);
  const [code, setCode] = useState("");
  const [codeAttempts, setCodeAttempts] = useState(0);
  const [codeLocked, setCodeLocked] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) {
        setLinkReason("timeout");
        setInvalidLink(true);
      }
    }, 8_000);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
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
        setLinkReason(isExpiredLinkError(error) ? "expired" : "used");
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

  // Focus automat pe câmpul de cod imediat ce devine vizibil (tastatură numerică pe mobil).
  useEffect(() => {
    if (codeRequired && !codeLocked) {
      const id = window.setTimeout(() => codeInputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [codeRequired, codeLocked]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  function failLink(reason: "expired" | "used") {
    setReady(false);
    setLinkReason(reason);
    setInvalidLink(true);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      const c = parsed.error.issues[0]?.message;
      errors.password = t(c === "password_max" ? "auth.errors.passwordMax" : "auth.errors.passwordMin");
    }
    if (password !== confirm) errors.confirm = t("auth.errors.passwordsDontMatch");
    if (codeRequired && !/^\d{6}$/.test(code)) {
      errors.code = "Introdu codul de 6 cifre primit pe email.";
    }
    return errors;
  }

  async function sendEmailCode(silent = false) {
    setResending(true);
    try {
      const { error } = await supabase.auth.reauthenticate();
      if (error) throw error;
      setResendCooldown(60);
      if (!silent) toast.success("Ți-am trimis un cod de verificare pe email.");
      return true;
    } catch (error) {
      const mapped = translateAuthError(t, error);
      setFormError(`${mapped.message} ${mapped.action}`);
      return false;
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || codeLocked) return;
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Verifică datele marcate mai jos.");
      if (errors.code) codeInputRef.current?.focus();
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      // getUser verifică tokenul la server; getSession singur poate întoarce o
      // sesiune locală expirată și formularul ar eșua apoi cu o eroare generică.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        failLink("expired");
        setFormError("Linkul de resetare nu mai este valid. Cere un link nou.");
        return;
      }

      const { error } = await supabase.auth.updateUser(
        codeRequired ? { password, nonce: code } : { password },
      );
      if (error) {
        if (codeRequired && isInvalidEmailCode(error)) {
          const attempts = codeAttempts + 1;
          setCodeAttempts(attempts);
          setCode("");
          if (attempts >= MAX_CODE_ATTEMPTS) {
            setCodeLocked(true);
            setFormError(
              "Prea multe coduri greșite. Din motive de securitate, cere un link nou de resetare.",
            );
            return;
          }
          setFieldErrors({
            code: `Cod incorect sau expirat. Mai ai ${MAX_CODE_ATTEMPTS - attempts} încercări.`,
          });
          setFormError("Codul de pe email nu a fost acceptat. Verifică ultimul email primit.");
          codeInputRef.current?.focus();
          return;
        }
        if (codeRequired) {
          const mapped = translateAuthError(t, error);
          setFormError(`${mapped.message} ${mapped.action}`);
          if (mapped.code === "same_password" || mapped.code === "weak_password") {
            setFieldErrors((current) => ({ ...current, password: mapped.message }));
          }
          toast.error(mapped.message, { description: mapped.action });
          return;
        }
        if (needsEmailCode(error)) {
          setCodeRequired(true);
          const sent = await sendEmailCode(true);
          setFormError(
            sent
              ? "Pentru siguranță, confirmă schimbarea cu codul de 6 cifre trimis pe email."
              : "Pentru siguranță e nevoie de un cod pe email. Apasă „Trimite codul din nou”.",
          );
          return;
        }
        if (isExpiredLinkError(error)) {
          failLink("expired");
          setFormError("Linkul de resetare a expirat. Cere un link nou.");
          return;
        }
        const mapped = translateAuthError(t, error);
        setFormError(`${mapped.message} ${mapped.action}`);
        toast.error(mapped.message, { description: mapped.action });
        return;
      }

      await supabase.auth.signOut({ scope: "local" });
      toast.success(t("auth.errors.passwordUpdated"));
      navigate({ to: "/auth", search: { mode: "login" }, replace: true });
    } catch (error) {
      const mapped = translateAuthError(t, error);
      setFormError(`${mapped.message} ${mapped.action}`);
      toast.error(mapped.message, { description: mapped.action });
    } finally {
      setSubmitting(false);
    }
  }

  const linkMessage =
    linkReason === "timeout"
      ? "Nu am putut valida linkul de resetare. Poate a expirat sau conexiunea s-a întrerupt."
      : linkReason === "used"
        ? "Linkul de resetare a fost deja folosit. Cere unul nou ca să continui."
        : "Linkul de resetare a expirat. Linkurile sunt valabile o perioadă scurtă, din motive de securitate.";

  return (
    <main className="relative min-h-dvh bg-background px-6 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="wordmark text-4xl font-medium">Suzeta</h1>
        <h2 className="mt-6 text-xl font-medium">{t("auth.resetPassword.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {ready ? t("auth.resetPassword.subtitle") : t("auth.resetPassword.validating")}
        </p>

        {invalidLink && !ready && (
          <div
            role="alert"
            data-testid="reset-link-invalid"
            className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4"
          >
            <p className="text-sm text-foreground">{linkMessage}</p>
            <Button
              className="mt-4 w-full rounded-full"
              onClick={() => navigate({ to: "/auth", search: { mode: "login" }, replace: true })}
            >
              Cere un link nou
            </Button>
            <Button
              variant="ghost"
              className="mt-2 w-full rounded-full"
              onClick={() => navigate({ to: "/auth", search: { mode: "login" }, replace: true })}
            >
              Înapoi la autentificare
            </Button>
          </div>
        )}

        {ready && (
          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {formError && (
              <div
                role="alert"
                aria-live="assertive"
                data-testid="reset-form-error"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>{formError}</span>
              </div>
            )}
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
                  autoComplete="new-password"
                  minLength={8}
                  required
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "pw-error" : undefined}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className="pl-10"
                />
              </div>
              {fieldErrors.password && (
                <p id="pw-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.password}
                </p>
              )}
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
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={!!fieldErrors.confirm}
                aria-describedby={fieldErrors.confirm ? "pw2-error" : undefined}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                }}
              />
              {fieldErrors.confirm && (
                <p id="pw2-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.confirm}
                </p>
              )}
            </div>
            {codeRequired && (
              <div className="space-y-1.5" data-testid="reset-email-code-step">
                <Label
                  htmlFor="email-code"
                  className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Cod de verificare primit pe email
                </Label>
                <div className="relative">
                  <MailCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email-code"
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    disabled={codeLocked}
                    aria-invalid={!!fieldErrors.code}
                    aria-describedby="code-hint"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      if (fieldErrors.code) setFieldErrors((prev) => ({ ...prev, code: undefined }));
                    }}
                    className="h-12 pl-10 text-center text-lg tracking-[0.4em]"
                    placeholder="000000"
                  />
                </div>
                <p
                  id="code-hint"
                  role={fieldErrors.code ? "alert" : undefined}
                  aria-live="polite"
                  className={fieldErrors.code ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                >
                  {fieldErrors.code ??
                    "Deschide emailul primit acum de la Suzeta și introdu codul de 6 cifre."}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-full text-xs"
                  disabled={resending || resendCooldown > 0 || codeLocked}
                  onClick={() => void sendEmailCode()}
                >
                  {resending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : resendCooldown > 0 ? (
                    `Trimite codul din nou în ${resendCooldown}s`
                  ) : (
                    "Trimite codul din nou"
                  )}
                </Button>
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting || codeLocked || (codeRequired && code.length !== 6)}
              className="h-12 w-full rounded-full text-sm uppercase tracking-[0.18em]"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : codeRequired ? (
                "Confirmă și schimbă parola"
              ) : (
                t("auth.resetPassword.submit")
              )}
            </Button>
            {codeLocked && (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-full"
                onClick={() => navigate({ to: "/auth", search: { mode: "login" }, replace: true })}
              >
                Cere un link nou
              </Button>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
