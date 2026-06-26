import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { startAgeVerification } from "@/lib/age-verification.functions";
import { shouldEnforceAgeGate } from "@/lib/age-gate-policy";
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
  // Feature-flag gate (DEV-only bypass). PRODUCȚIA forțează enforcement = true.
  // Vezi src/lib/age-gate-policy.ts + AGENTS.md → REGULĂ AGE GATE.
  // Default initial = isProductionHost() ca să evităm flash de modal în preview
  // înainte ca citirea flag-ului async să termine.
  const [enforce, setEnforce] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const h = window.location.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return false;
    if (h.startsWith("id-preview--")) return false;
    if (h.endsWith("-dev.lovable.app") || h.endsWith("--dev.lovable.app")) return false;
    if (h.endsWith(".lovableproject.com")) return false;
    if (h.endsWith(".lovable.dev")) return false;
    return true;
  });
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
    // Recheck policy on every nav (TTL cache în age-gate-policy).
    void shouldEnforceAgeGate().then(setEnforce);
  }, [location.pathname]);

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
  // DEV BYPASS: dacă enforcement-ul e oprit (feature flag OFF + host non-prod),
  // nu afișăm modal și nu pornim Didit. Codul Didit rămâne intact, doar UI-ul
  // de blocare e ocolit. Producția forțează enforce=true în age-gate-policy.
  if (!enforce) {
    if (typeof window !== "undefined" && !(window as any).__ageGateDevWarned) {
      (window as any).__ageGateDevWarned = true;
      // eslint-disable-next-line no-console
      console.warn("⚠️ [DEV] AGE VERIFICATION DEZACTIVAT prin feature_flags.age_verification. Se reactivează automat în producție.");
    }
    return null;
  }
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

        <label className="flex items-start gap-2 text-left text-xs text-muted-foreground leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <span>
            Sunt de acord ca un selfie biometric să fie trimis către{" "}
            <a href="https://didit.me/privacy-policy" target="_blank" rel="noreferrer" className="underline">Didit</a>
            {" "}pentru estimarea vârstei. Imaginea este prelucrată conform politicii Didit (păstrată maxim 30 zile) și nu este folosită în alte scopuri. Pot retrage acest consimțământ din Setări → Confidențialitate.
          </span>
        </label>

        <button
          onClick={handleStart}
          disabled={submitting || !consent}
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
