import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

type FB = { id: string; kind: string; message: string; page: string | null; status: string; created_at: string; user_id: string | null };

export function FeedbackInbox() {
  const [items, setItems] = useState<FB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"new" | "all">("new");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(50);
    if (filter === "new") q = q.eq("status", "new");
    const { data, error } = await q;
    if (error) toast.error(error.message); else setItems((data ?? []) as FB[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  async function markDone(id: string) {
    const { error } = await supabase.from("feedback").update({ status: "done" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marcat ca rezolvat"); load(); }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Feedback utilizatori</h3>
        <div className="ml-auto flex gap-1">
          <button onClick={() => setFilter("new")} className={`rounded-full px-2 py-0.5 text-xs ${filter === "new" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Noi</button>
          <button onClick={() => setFilter("all")} className={`rounded-full px-2 py-0.5 text-xs ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Toate</button>
        </div>
      </div>
      {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Nimic nou.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((f) => (
            <li key={f.id} className="flex items-start gap-2 py-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${f.kind === "bug" ? "bg-destructive/15 text-destructive" : f.kind === "idea" ? "bg-blue-500/15 text-blue-500" : "bg-muted"}`}>{f.kind}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{f.message}</p>
                <p className="text-[10px] text-muted-foreground">{f.page} · {new Date(f.created_at).toLocaleString()}</p>
              </div>
              {f.status === "new" && (
                <button onClick={() => markDone(f.id)} className="rounded-full p-1 hover:bg-muted" aria-label="Rezolvat">
                  <Check className="h-4 w-4 text-emerald-500" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
