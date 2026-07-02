import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FlaskConical, Plus, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { useAdminPanelLoad, PanelStatus } from "@/components/admin/PanelStatus";

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
            <li key={e.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-mono">{e.key}</p>
                <p className="text-xs text-muted-foreground">
                  {e.variants.join(" · ")} ({e.weights.join("/")})
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${e.status === "running" ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}
              >
                {e.status}
              </span>
              <button onClick={() => toggleStatus(e)} className="rounded-full p-1 hover:bg-muted">
                {e.status === "running" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </PanelStatus>
    </section>
  );
}
