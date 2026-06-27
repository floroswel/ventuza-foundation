import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { type ConsentKind, CONSENT_REGISTRY } from "@/lib/consent-registry";

/**
 * Verifică / înregistrează consimțământul curent pentru un kind dat.
 * Folosește RPC `has_active_consent` și `record_consent` (vezi AGENTS.md).
 *
 * `ensure()` întoarce true dacă userul a acceptat (existent sau acordat acum
 * după confirmare). Folosit pentru a gata UI-ul de funcții opționale (AI etc.).
 */
export function useConsent(kind: ConsentKind) {
  const { user } = useAuth();
  const [active, setActive] = useState<boolean | null>(null);
  const meta = CONSENT_REGISTRY[kind];

  useEffect(() => {
    if (!user) {
      setActive(false);
      return;
    }
    void (async () => {
      const { data } = await supabase.rpc("has_active_consent", {
        _user_id: user.id,
        _kind: kind,
      });
      setActive(data === true);
    })();
  }, [user?.id, kind]);

  const grant = useCallback(async () => {
    const { error } = await supabase.rpc("record_consent", {
      _kind: kind,
      _accepted: true,
    });
    if (error) {
      toast.error("Nu am putut înregistra consimțământul.");
      return false;
    }
    setActive(true);
    return true;
  }, [kind]);

  const ensure = useCallback(async (): Promise<boolean> => {
    if (active) return true;
    if (typeof window === "undefined") return false;
    // Folosim registrul unificat (ConsentPromptHost) — interzis window.confirm
    // pentru consimțăminte GDPR (vezi AGENTS.md).
    const { requestConsent } = await import("@/components/ConsentPromptHost");
    const ok = await requestConsent({ label: meta.label, description: meta.description });
    if (!ok) return false;
    return await grant();
  }, [active, grant, meta.label, meta.description]);

  return { active, ensure, grant, meta };
}
