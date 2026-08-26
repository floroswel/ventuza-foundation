import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, Loader2, Lock, ShieldCheck } from "lucide-react";
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

const MAX_MFA_ATTEMPTS = 5;

type FieldErrors = {
  password?: string;
  confirm?: string;
  mfa?: string;
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
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaAttempts, setMfaAttempts] = useState(0);
  const [mfaLocked, setMfaLocked] = useState(false);
  const mfaInputRef = useRef<HTMLInputElement>(null);

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

  // Focus automat pe câmpul 2FA imediat ce devine vizibil (tastatură numerică pe mobil).
  useEffect(() => {
    if (mfaRequired && !mfaLocked) {
      const id = window.setTimeout(() => mfaInputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [mfaRequired, mfaLocked]);

  function failLink(reason: "expired" | "used") {
    setReady(false);
    setLinkReason(reason);
    setInvalidLink(true);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      errors.password = t(code === "password_max" ? "auth.errors.passwordMax" : "auth.errors.passwordMin");
    }
    if (password !== confirm) errors.confirm = t("auth.errors.passwordsDontMatch");
    if (mfaRequired && !/^\d{6}$/.test(mfaCode)) {
      errors.mfa = "Introdu codul de 6 cifre din aplicația ta de autentificare.";
    }
    return errors;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || mfaLocked) return;
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Verifică datele marcate mai jos.");
      if (errors.mfa) mfaInputRef.current?.focus();
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

      if (mfaRequired) {
        const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: mfaFactorId!,
          code: mfaCode,
        });
        if (mfaError) {
          const attempts = mfaAttempts + 1;
          setMfaAttempts(attempts);
          setMfaCode("");
          if (attempts >= MAX_MFA_ATTEMPTS) {
            setMfaLocked(true);
            setFormError(
              "Prea multe coduri greșite. Din motive de securitate, cere un link nou de resetare.",
            );
            return;
          }
          setFieldErrors({
            mfa: `Cod incorect sau expirat. Mai ai ${MAX_MFA_ATTEMPTS - attempts} încercări.`,
          });
          setFormError("Codul 2FA nu a fost acceptat. Introdu codul afișat acum în aplicație.");
          mfaInputRef.current?.focus();
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (/aal2 session is required|mfa.*required/i.test(error.message)) {
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
          const verifiedFactor = factors?.all.find((factor) => factor.status === "verified");
          if (!factorsError && verifiedFactor) {
            setMfaFactorId(verifiedFactor.id);
            setMfaRequired(true);
            setFormError("Pentru protecția contului, confirmă schimbarea cu codul 2FA.");
            return;
          }
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
            {mfaRequired && (
              <div className="space-y-1.5" data-testid="reset-mfa-step">
                <Label
                  htmlFor="mfa-code"
                  className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Cod de verificare 2FA
                </Label>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="mfa-code"
                    ref={mfaInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    disabled={mfaLocked}
                    aria-invalid={!!fieldErrors.mfa}
                    aria-describedby="mfa-hint"
                    value={mfaCode}
                    onChange={(event) => {
                      setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      if (fieldErrors.mfa) setFieldErrors((prev) => ({ ...prev, mfa: undefined }));
                    }}
                    className="h-12 pl-10 text-center text-lg tracking-[0.4em]"
                    placeholder="000000"
                  />
                </div>
                <p
                  id="mfa-hint"
                  role={fieldErrors.mfa ? "alert" : undefined}
                  aria-live="polite"
                  className={fieldErrors.mfa ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                >
                  {fieldErrors.mfa ??
                    "Deschide aplicația de autentificare și introdu codul de 6 cifre valabil acum."}
                </p>
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting || mfaLocked || (mfaRequired && mfaCode.length !== 6)}
              className="h-12 w-full rounded-full text-sm uppercase tracking-[0.18em]"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mfaRequired ? (
                "Confirmă și schimbă parola"
              ) : (
                t("auth.resetPassword.submit")
              )}
            </Button>
            {mfaLocked && (
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
