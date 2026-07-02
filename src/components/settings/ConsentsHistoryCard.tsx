import { useEffect, useState } from "react";
import { History, Loader2, Check, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CONSENT_REGISTRY, type ConsentKind } from "@/lib/consent-registry";

type Row = {
  id: number;
  kind: string;
  version: string;
  accepted: boolean;
  created_at: string;
};

const KIND_FILTERS: Array<{ value: "all" | ConsentKind; label: string }> = [
  { value: "all", label: "Toate" },
  ...(Object.keys(CONSENT_REGISTRY) as ConsentKind[]).map((k) => ({
    value: k,
    label: CONSENT_REGISTRY[k].label,
  })),
];

function labelFor(kind: string): string {
  return (CONSENT_REGISTRY as Record<string, { label: string }>)[kind]?.label ?? kind;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ConsentsHistoryCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ConsentKind>("all");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    let q = supabase
      .from("consent_log")
      .select("id, kind, version, accepted, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("kind", filter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, filter]);

  // Latest action per kind (for the "ultima acțiune" summary).
  const latestByKind = new Map<string, Row>();
  for (const r of rows) {
    if (!latestByKind.has(r.kind)) latestByKind.set(r.kind, r);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <History className="size-4" /> Istoric consimțiri
        </h2>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="Reîncarcă istoricul"
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> Reîncarcă
        </button>
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Toate acordările și retragerile de consimțământ sunt salvate cu dată, tip și versiune. Vezi
        ultimele 100 de acțiuni pe acest cont.
      </p>

      {/* Filter chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              filter === f.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Latest-per-kind summary (only when no filter) */}
      {filter === "all" && latestByKind.size > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-background p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Ultima acțiune per tip
          </p>
          <ul className="divide-y divide-border">
            {Array.from(latestByKind.values()).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-1.5 text-xs">
                <span className="truncate pr-2">{labelFor(r.kind)}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                    r.accepted
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {r.accepted ? <Check className="size-3" /> : <X className="size-3" />}
                  {r.accepted ? "Acordat" : "Retras"} · {fmtDate(r.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full log */}
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
          >
            Nu am putut încărca istoricul: {error}
            <button
              onClick={() => void load()}
              className="ml-2 underline underline-offset-2 hover:text-rose-100"
            >
              Reîncearcă
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-background p-3 text-center text-xs text-muted-foreground">
            Nicio înregistrare de consimțământ.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{labelFor(r.kind)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    v{r.version} · {fmtDate(r.created_at)}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    r.accepted
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {r.accepted ? <Check className="size-3" /> : <X className="size-3" />}
                  {r.accepted ? "Acordat" : "Retras"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
