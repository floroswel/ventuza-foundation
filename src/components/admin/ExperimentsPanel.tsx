import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FlaskConical, Plus, Play, Pause, BarChart2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAdminPanelLoad, PanelStatus } from "@/components/admin/PanelStatus";
import { getExperimentResults } from "@/lib/admin-intelligence.functions";

type Exp = {
  id: string;
  key: string;
  description: string | null;
  variants: string[];
  weights: number[];
  status: string;
};

export function ExperimentsPanel() {
  const [showNew, setShowNew] = useState(false);

  const [state, reload] = useAdminPanelLoad<Exp[]>(async () => {
    const { data, error } = await supabase
      .from("experiments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Exp[];
  }, []);

  async function toggleStatus(e: Exp) {
    const next = e.status === "running" ? "paused" : "running";
    const { error } = await supabase.from("experiments").update({ status: next }).eq("id", e.id);
    if (error) toast.error(error.message);
    else reload();
  }

  async function createExp(form: FormData) {
    const key = String(form.get("key") || "").trim();
    const variantsRaw = String(form.get("variants") || "control,treatment").trim();
    const weightsRaw = String(form.get("weights") || "50,50").trim();
    const variants = variantsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const weights = weightsRaw.split(",").map((s) => parseInt(s.trim(), 10) || 0);
    const { error } = await supabase.from("experiments").insert({
      key,
      description: String(form.get("description") || "").trim() || null,
      variants,
      weights,
      status: "draft",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Experiment creat");
      setShowNew(false);
      reload();
    }
  }

  const items = state.status === "ready" ? state.data : [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">A/B Experiments</h3>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="ml-auto flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> Nou
        </button>
      </div>
      {showNew && (
        <form
          className="mb-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            createExp(new FormData(e.currentTarget));
          }}
        >
          <input
            name="key"
            required
            placeholder="key (ex: discover_layout_v2)"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            name="description"
            placeholder="Descriere"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            name="variants"
            defaultValue="control,treatment"
            placeholder="variants (CSV)"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            name="weights"
            defaultValue="50,50"
            placeholder="weights (CSV)"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Creează
          </button>
        </form>
      )}
      <PanelStatus
        state={state}
        retry={reload}
        isEmpty={state.status === "ready" && items.length === 0}
        emptyHint="Niciun experiment definit. Apasă „Nou” ca să pornești primul A/B."
      >
        <ul className="divide-y divide-border/60">
          {items.map((e) => (
            <ExperimentRow key={e.id} exp={e} onToggle={() => toggleStatus(e)} />
          ))}
        </ul>
      </PanelStatus>
    </section>
  );
}

function ExperimentRow({ exp, onToggle }: { exp: Exp; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const runResults = useServerFn(getExperimentResults);
  const [state, reload] = useAdminPanelLoad<Awaited<ReturnType<typeof getExperimentResults>> | null>(
    async () => (open ? runResults({ data: { key: exp.key, days: 60 } }) : null),
    [open, exp.key],
  );
  const res = state.status === "ready" ? state.data : null;

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-mono">{exp.key}</p>
          <p className="text-xs text-muted-foreground">
            {exp.variants.join(" · ")} ({exp.weights.join("/")})
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ${exp.status === "running" ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}
        >
          {exp.status}
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-1 hover:bg-muted"
          title="Rezultate + p-value"
        >
          <BarChart2 className="h-4 w-4" />
        </button>
        <button onClick={onToggle} className="rounded-full p-1 hover:bg-muted">
          {exp.status === "running" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
          {state.status === "loading" && (
            <p className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Se agregă…
            </p>
          )}
          {state.status === "error" && (
            <p className="text-red-300">
              {state.error}{" "}
              <button onClick={reload} className="underline">
                reîncearcă
              </button>
            </p>
          )}
          {res && (
            <div className="space-y-2">
              {res.exposure_fallback && (
                <p className="text-[11px] text-amber-300/80">
                  Fără evenimente „exposure"/„conversion" înregistrate — folosim orice event ca observație.
                </p>
              )}
              <table className="w-full">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th>Variant</th>
                    <th>Exposures</th>
                    <th>Conversions</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {res.per_variant.map((v) => (
                    <tr key={v.variant} className="border-t border-border/40">
                      <td className="py-1 font-mono">{v.variant}</td>
                      <td>{v.exposures}</td>
                      <td>{v.conversions}</td>
                      <td>{(v.rate * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {res.comparisons.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    z-test bilateral vs. control
                  </p>
                  <ul className="space-y-0.5">
                    {res.comparisons.map((c) => {
                      const sig = c.p_value != null && c.p_value < 0.05;
                      const strong = c.p_value != null && c.p_value < 0.01;
                      return (
                        <li key={c.variant} className="flex items-center gap-2">
                          <span className="font-mono">
                            {c.variant} vs {c.vs}
                          </span>
                          <span className={c.lift != null && c.lift > 0 ? "text-emerald-400" : "text-red-300"}>
                            lift {c.lift != null ? `${(c.lift * 100).toFixed(1)}%` : "—"}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${strong ? "bg-emerald-500/20 text-emerald-300" : sig ? "bg-amber-500/15 text-amber-300" : "bg-muted text-muted-foreground"}`}
                          >
                            p = {c.p_value != null ? c.p_value.toFixed(4) : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Nu opri experimentul devreme pe baza p-value (peeking). Fixează MDE + putere înainte.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
