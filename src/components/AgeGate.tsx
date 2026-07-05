import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { shouldEnforceAgeGate } from "@/lib/age-gate-policy";

/**
 * AgeGate — VERIFICARE INTERNĂ.
 *
 * Fluxul nou (liveness intern + review moderator) trăiește la /verify.
 * AgeGate blochează accesul la rutele adult pentru useri neverificati
 * sau la status 'failed/expired' și îi redirecționează către /verify.
 *
 * Regula de acces limitat pending: user cu age_status='pending' vede TOATE
 * ecranele care nu sunt în GATED_PREFIXES (poate edita profil, vedea safety,
 * legal, settings) dar nu poate accesa discover/messages/etc.
 */

const GATED_PREFIXES = [
  "/discover",
  "/messages",
  "/swipe",
  "/visitors",
  "/favorites",
  "/groups",
  "/events",
  "/quests",
  "/cruise",
  "/nearby",
];

type Status = "unverified" | "pending" | "verified" | "failed" | "expired" | null;

export function AgeGate() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>(null);
  const [checking, setChecking] = useState(true);
  const [enforce, setEnforce] = useState<boolean>(true);

  const isGated = GATED_PREFIXES.some((p) => location.pathname.startsWith(p));

  const refresh = async (uid: string) => {
    setChecking(true);
    const { data } = await supabase
      .from("profiles")
      .select("age_status")
      .eq("id", uid)
      .maybeSingle();
    const s = (data?.age_status as Status) ?? "unverified";
    setStatus(s);
    setChecking(false);
    // Dacă e în pending, cere sincronizare cu Didit în background —
    // așa prindem aprobările manuale din dashboard-ul Didit fără webhook.
    if (s === "pending" || s === "unverified") {
      try {
        const { syncMyDiditStatus } = await import("@/lib/didit.functions");
        const res = await syncMyDiditStatus();
        if (res && "ok" in res && res.ok) {
          const { data: fresh } = await supabase
            .from("profiles")
            .select("age_status")
            .eq("id", uid)
            .maybeSingle();
          if (fresh?.age_status) setStatus(fresh.age_status as Status);
        }
      } catch {
        // silențios — nu e sesiune, sau nu are decizie încă
      }
    }
  };

  useEffect(() => {
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

  // Realtime — dacă webhook-ul Didit actualizează `profiles.age_status`, primim
  // instant update-ul fără refresh sau navigare.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-age-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const next = (payload.new as { age_status?: Status })?.age_status;
          if (next) setStatus(next);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Polling de siguranță — dacă statusul e pending/unverified, cerem sync
  // periodic din Didit (prinde review manual chiar dacă webhook-ul eșuează).
  useEffect(() => {
    if (!user) return;
    if (status !== "pending" && status !== "unverified") return;
    const id = setInterval(() => void refresh(user.id), 15000);
    return () => clearInterval(id);
  }, [user?.id, status]);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user?.id]);

  if (authLoading || !user || !isGated) return null;

  const userForced =
    typeof window !== "undefined" && sessionStorage.getItem("force_age_gate") === "1";

  if (!enforce && !userForced) return null;

  if (checking || status === null) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-xl">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (status === "verified") return null;

  // Pending — arată mesaj că e în review + link către /verify pentru status
  const isPending = status === "pending";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-xl px-6">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl border border-border bg-card shadow-2xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isPending ? "Verificare în curs" : t("age.title")}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isPending
              ? "Am înregistrat sesiunea ta Didit. Îți trimitem notificare imediat ce primim rezultatul (de obicei sub 1 minut)."
              : "Contul tău trebuie verificat pentru a accesa această secțiune. Verificarea durează ~30 secunde și se face prin Didit (procesator UE)."}
          </p>
        </div>

        <button
          onClick={() => navigate({ to: "/verify" as never })}
          className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isPending ? "Vezi statusul" : "Începe verificarea"}
        </button>

        {isPending && (
          <p className="text-xs text-muted-foreground">
            Poți continua să folosești profilul, setările și paginile de siguranță în timp ce
            aștepți.
          </p>
        )}
      </div>
    </div>
  );
}
