import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CONSENT_REGISTRY, type ConsentKind } from "@/lib/consent-registry";

/**
 * UI unic pentru gestionarea consimțămintelor opționale.
 * Sursa de adevăr e `consent_log` + `public.consent_kinds()` (vezi AGENTS.md
 * "REGULĂ — CONSIMȚĂMINTE"). Toate scrierile trec prin RPC `record_consent`.
 *
 * Kind-urile `terms` și `privacy` (required) NU sunt afișate aici — se acceptă
 * la onboarding și nu se pot retrage fără ștergerea contului.
 */
const OPTIONAL_KINDS: ConsentKind[] = [
  "health_data",
  "age_verification",
  "ai_features",
  "push_notifications",
  "marketing",
];

export function ConsentsCard() {
  const { user } = useAuth();
  const [state, setState] = useState<Partial<Record<ConsentKind, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ConsentKind | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      // Citim cea mai recentă intrare per kind.
      const { data } = await supabase
        .from("consent_log")
        .select("kind, accepted, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const latest: Partial<Record<ConsentKind, boolean>> = {};
      for (const row of data ?? []) {
        const k = row.kind as ConsentKind;
        if (!(k in latest)) latest[k] = !!row.accepted;
      }
      setState(latest);
      setLoading(false);
    })();
  }, [user?.id]);

  async function toggle(kind: ConsentKind, accepted: boolean) {
    if (!user) return;
    setBusy(kind);
    try {
      const { error } = await supabase.rpc("record_consent", {
        _kind: kind,
        _accepted: accepted,
      });
      if (error) throw error;
      setState((s) => ({ ...s, [kind]: accepted }));

      // Acțiuni cascade pentru retragere (DB-ul are deja triggerul pentru health_data).
      if (!accepted) {
        if (kind === "push_notifications") {
          try {
            const reg = await navigator.serviceWorker?.getRegistration();
            const sub = await reg?.pushManager?.getSubscription();
            if (sub) await sub.unsubscribe();
          } catch { /* best-effort */ }
        }
        toast.success("Consimțământ retras. Prelucrarea aferentă a fost oprită.");
      } else {
        toast.success("Consimțământ înregistrat.");
      }
    } catch (e) {
      console.error("[consent toggle]", e);
      toast.error("Nu am putut salva consimțământul.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <ShieldCheck className="size-4" /> Consimțăminte GDPR
        {loading && <Loader2 className="ml-1 inline size-3 animate-spin" />}
      </h2>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Toate sunt opționale și pot fi retrase oricând. Retragerea oprește
        imediat prelucrarea (și șterge datele unde se aplică).
      </p>
      <div className="mt-3 divide-y divide-border">
        {OPTIONAL_KINDS.map((kind) => {
          const meta = CONSENT_REGISTRY[kind];
          const active = !!state[kind];
          return (
            <div key={kind} className="py-3">
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {meta.label}
                    {meta.art9 && (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                        Art. 9
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    {meta.description}
                  </p>
                  {meta.processor && (
                    <p className="mt-1 text-[10px] text-muted-foreground/80">
                      Procesator: {meta.processor}
                    </p>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={active}
                  disabled={busy === kind}
                  onChange={(e) => void toggle(kind, e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
