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
import { logAccountFlowEvent } from "@/lib/account-flow.functions";

/** Audit backend pentru fluxul de resetare parolă (fără PII, doar coduri de stare). */
function logReset(stage: string, detail?: Record<string, string | number | boolean | null>) {
  void logAccountFlowEvent({ data: { kind: "password_reset", stage, detail } }).catch(() => {});
}

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

/** Cod OTP corect ca format, dar expirat (fereastra de valabilitate a trecut). */
function isExpiredEmailCode(error: unknown) {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return msg.includes("nonce") && (msg.includes("expired") || msg.includes("otp_expired"));
}

/** Sesiunea de recovery nu mai e validă la momentul submit-ului. */
function isSessionExpiredError(error: unknown) {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return (
    msg.includes("auth session missing") ||
    msg.includes("session_not_found") ||
    msg.includes("session from session_id claim in jwt does not exist") ||
    msg.includes("jwt expired") ||
    msg.includes("session expired") ||
    msg.includes("sesiunea a expirat") ||
    msg.includes("refresh token") ||
    (msg.includes("session") && msg.includes("expired"))
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
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) {
        setLinkReason("timeout");
        setInvalidLink(true);
      }
    }, 8_000);
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email) setUserEmail(session.user.email);
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
        setUserEmail(data.session.user?.email ?? null);
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
    if (resendCooldown > 0 || resending) return false;
    setResending(true);
    try {
      const { error } = await supabase.auth.reauthenticate();
      if (error) throw error;
      setResendCooldown(60);
      setCodeSentAt(Date.now());
      logReset("code_sent", { silent });
      if (!silent) toast.success("Ți-am trimis un cod de verificare pe email.");
      return true;
    } catch (error) {
      const mapped = translateAuthError(t, error);
      setFormError(`${mapped.message} ${mapped.action}`);
      logReset("code_send_failed", { code: mapped.code });
      // Chiar și la eșec ținem un mic cooldown ca să nu spamăm serverul de email.
      setResendCooldown((c) => (c > 0 ? c : 15));
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
      // Nu revalidăm sesiunea cu getUser() aici: linkul recovery a fost deja
      // verificat la încărcarea paginii, iar un refresh concurent poate întoarce
      // temporar `session expired` chiar dacă nonce-ul primit pe email este valid.
      // updateUser este operația autoritativă și validează atât sesiunea recovery,
      // cât și codul email (nonce) într-o singură cerere atomică.
      const { error } = await supabase.auth.updateUser(
        codeRequired ? { password, nonce: code } : { password },
      );
      if (error) {
        if (codeRequired && isInvalidEmailCode(error)) {
          const expired = isExpiredEmailCode(error);
          const attempts = codeAttempts + 1;
          setCodeAttempts(attempts);
          setCode("");
          logReset(expired ? "code_expired" : "code_invalid", { attempts });
          if (expired) {
            // Codul expirat nu consumă încercări „greșite” — cerem doar unul nou.
            setFieldErrors({
              code: "Codul a expirat. Apasă „Trimite codul din nou” și folosește ultimul email.",
            });
            setFormError("Codul de verificare a expirat. Cere un cod nou.");
            codeInputRef.current?.focus();
            return;
          }
          if (attempts >= MAX_CODE_ATTEMPTS) {
            setCodeLocked(true);
            logReset("code_locked", { attempts });
            setFormError(
              "Prea multe coduri greșite. Din motive de securitate, cere un link nou de resetare.",
            );
            return;
          }
          setFieldErrors({
            code: `Cod incorect. Mai ai ${MAX_CODE_ATTEMPTS - attempts} încercări.`,
          });
          setFormError("Codul introdus nu este cel din ultimul email primit.");
          codeInputRef.current?.focus();
          return;
        }
        if (codeRequired) {
          const mapped = translateAuthError(t, error);
          logReset("update_failed", { code: mapped.code });
          if (mapped.code === "same_password") {
            setFieldErrors((current) => ({
              ...current,
              password: "Parola nouă este identică cu cea veche. Alege alta.",
            }));
            setFormError(
              "Codul a fost acceptat, dar parola nouă este aceeași cu cea veche. Alege o parolă diferită.",
            );
            return;
          }
          if (mapped.code === "weak_password") {
            setFieldErrors((current) => ({ ...current, password: mapped.message }));
            setFormError(`Codul a fost acceptat, dar parola nu e acceptată. ${mapped.action}`);
            return;
          }
          setFormError(`${mapped.message} ${mapped.action}`);
          toast.error(mapped.message, { description: mapped.action });
          return;
        }
        if (needsEmailCode(error)) {
          setCodeRequired(true);
          logReset("code_required");
          const sent = await sendEmailCode(true);
          setFormError(
            sent
              ? "Pentru siguranță, confirmă schimbarea cu codul de 6 cifre trimis pe email."
              : "Pentru siguranță e nevoie de un cod pe email. Apasă „Trimite codul din nou”.",
          );
          return;
        }
        if (isExpiredLinkError(error) && !codeRequired) {
          failLink("expired");
          logReset("link_expired");
          setFormError("Linkul de resetare a expirat. Cere un link nou.");
          return;
        }
        const mapped = translateAuthError(t, error);
        logReset("update_failed", { code: mapped.code });
        if (mapped.code === "same_password" || mapped.code === "weak_password") {
          setFieldErrors((current) => ({ ...current, password: mapped.message }));
        }
        setFormError(`${mapped.message} ${mapped.action}`);
        toast.error(mapped.message, { description: mapped.action });
        return;
      }

      logReset("password_updated", { withCode: codeRequired });
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
                    onPaste={(event) => {
                      // Lipire din email/SMS: păstrăm doar cifrele și completăm tot câmpul.
                      const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                      if (!pasted) return;
                      event.preventDefault();
                      setCode(pasted);
                      setFieldErrors((prev) => ({ ...prev, code: undefined }));
                      requestAnimationFrame(() => codeInputRef.current?.focus());
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
                    "Deschide emailul primit acum de la Suzeta și introdu (sau lipește) codul de 6 cifre."}
                </p>
                {!fieldErrors.code && codeSentAt !== null && (
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {resendCooldown > 0
                      ? `Poți cere un cod nou în ${resendCooldown}s.`
                      : "Poți cere un cod nou acum."}
                  </p>
                )}
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
