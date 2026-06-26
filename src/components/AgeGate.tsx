import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { startAgeVerification } from "@/lib/age-verification.functions";
import { toast } from "sonner";

// Routes that require a verified age before access.
const GATED_PREFIXES = ["/discover", "/messages", "/swipe", "/visitors", "/favorites", "/groups", "/events", "/quests"];

type Status = "unverified" | "pending" | "verified" | "failed" | "expired" | null;

export function AgeGate() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // GDPR Art. 9 — selfie-ul biometric e date sensibile; consimțământul e opt-in,
  // distinct de terms/privacy. Vezi src/lib/consent-registry.ts (kind=age_verification).
  const [consent, setConsent] = useState(false);
  const startFn = useServerFn(startAgeVerification);

  const isGated = GATED_PREFIXES.some((p) => location.pathname.startsWith(p));

  const refresh = async (uid: string) => {
    setChecking(true);
    const { data } = await supabase
      .from("profiles")
      .select("age_status")
      .eq("id", uid)
      .maybeSingle();
    setStatus((data?.age_status as Status) ?? "unverified");
    setChecking(false);
  };

  useEffect(() => {
    if (!user) {
      setStatus(null);
      setChecking(false);
      return;
    }
    void refresh(user.id);
  }, [user?.id, location.pathname]);

  // Re-check when tab regains focus (user returning from Didit).
  useEffect(() => {
    if (!user) return;
    const onFocus = () => void refresh(user.id);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user?.id]);

  if (authLoading || !user || !isGated) return null;
  if (checking || status === null) return null;
  if (status === "verified") return null;

  const handleStart = async () => {
    if (!consent) {
      toast.error("Trebuie să accepți procesarea imaginii biometrice de către Didit.");
      return;
    }
    setSubmitting(true);
    try {
      // Înregistrează consimțământul ÎNAINTE de a porni Didit. Vezi AGENTS.md.
      const { error: consentErr } = await supabase.rpc("record_consent", {
        _kind: "age_verification",
        _accepted: true,
      });
      if (consentErr) throw consentErr;

      const callbackUrl = `${window.location.origin}${location.pathname}`;
      const result = await startFn({ data: { callbackUrl } });
      if (!result.ok) {
        toast.error(result.message ?? "Nu am putut porni verificarea.");
        setSubmitting(false);
        return;
      }
      window.location.href = result.url;
    } catch (err) {
      console.error(err);
      toast.error("Nu am putut porni verificarea. Încearcă din nou.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-xl px-6">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl border border-border bg-card shadow-2xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("age.title")}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("age.desc")}</p>
        </div>

        {status === "pending" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("age.pending")}
          </div>
        )}

        {status === "failed" && (
          <p className="text-sm text-destructive">{t("age.failed")}</p>
        )}

        <button
          onClick={handleStart}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("age.opening")}
            </>
          ) : status === "pending" ? (
            t("age.resume")
          ) : (
            t("age.cta")
          )}
        </button>

        {status === "pending" && user && (
          <button
            onClick={() => void refresh(user.id)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            {t("age.check")}
          </button>
        )}
      </div>
    </div>
  );
}
