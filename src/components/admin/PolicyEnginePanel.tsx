import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Scale, Play, Pause, Archive, FlaskConical, GitBranch, Loader2, Plus,
  RefreshCw, Sparkles, ShieldCheck, AlertTriangle,
} from "lucide-react";
import {
  policyListRules, policyUpsertRule, policySetState, policySimulate,
  policyRecentEvaluations, policyListVersions,
} from "@/lib/admin-policy.functions";
import { GlassCard, SectionTitle, StatusBadge } from "@/components/admin/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type Rule = {
  id: string; code: string; category: string; title: string; description: string | null;
  state: "draft" | "shadow" | "enforcing" | "archived";
  version: number; expression: Record<string, unknown>; action: Record<string, unknown>;
  updated_at: string;
};

const STATE_COLORS: Record<Rule["state"], string> = {
  draft: "bg-slate-500/15 text-slate-300",
  shadow: "bg-blue-500/15 text-blue-300",
  enforcing: "bg-emerald-500/15 text-emerald-300",
  archived: "bg-neutral-500/15 text-neutral-400",
};

export function PolicyEnginePanel() {
  const list = useServerFn(policyListRules);
  const upsert = useServerFn(policyUpsertRule);
  const setState = useServerFn(policySetState);
  const simulate = useServerFn(policySimulate);
  const recent = useServerFn(policyRecentEvaluations);
  const listVersions = useServerFn(policyListVersions);

  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const rows = await list();
      setRules(rows as Rule[]);
      if (!selectedId && rows.length > 0) setSelectedId((rows as Rule[])[0].id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [list, selectedId]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => rules?.find((r) => r.id === selectedId) ?? null,
    [rules, selectedId],
  );

  const byCategory = useMemo(() => {
    const g: Record<string, Rule[]> = {};
    for (const r of rules ?? []) (g[r.category] ??= []).push(r);
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rules]);

  const onChangeState = async (state: Rule["state"]) => {
    if (!selected) return;
    if (state === "enforcing") {
      const note = window.prompt(
        `Promovezi "${selected.code}" în ENFORCING. Va afecta traficul real.\n\nMotiv (obligatoriu):`,
        "",
      );
      if (!note || note.trim().length < 5) { toast.error("Motiv necesar (min. 5 caractere)"); return; }
      try {
        await setState({ data: { ruleId: selected.id, state, note } });
        toast.success("Regulă activă în ENFORCING"); load();
      } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
      return;
    }
    try {
      await setState({ data: { ruleId: selected.id, state } });
      toast.success(`Stare: ${state}`); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle>Policy Engine · Reguli versionate · Shadow mode · Backtest</SectionTitle>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setCreating(true); setEditorOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
          >
            <Plus className="size-3.5" /> Regulă nouă
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <GlassCard>
          <div className="flex items-start gap-2 text-sm text-red-300">
            <AlertTriangle className="size-4 mt-0.5" />
            <div className="flex-1"><b>Eroare:</b> {error}</div>
            <button onClick={load} className="rounded-md border border-red-500/40 px-2 py-0.5 text-xs">Reîncearcă</button>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Sidebar: rule list */}
        <GlassCard>
          <div className="space-y-3">
            {loading && !rules && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            )}
            {rules && rules.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                <Sparkles className="mx-auto mb-2 size-5 text-primary" />
                Nicio regulă încă (empty legitim). Creează prima regulă cu "Regulă nouă".
              </div>
            )}
            {byCategory.map(([cat, items]) => (
              <div key={cat}>
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {cat}
                </p>
                <ul className="space-y-1">
                  {items.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => setSelectedId(r.id)}
                        className={`group flex w-full flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition ${
                          selectedId === r.id
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/40 bg-surface/40 hover:border-primary/30"
                        }`}
                      >
                        <div className="flex w-full items-center gap-2">
                          <span className="admin-mono flex-1 truncate text-[11px]">{r.code}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${STATE_COLORS[r.state]}`}>
                            {r.state}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground line-clamp-1">{r.title}</span>
                        <span className="text-[10px] text-muted-foreground/70">v{r.version}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Detail */}
        <div className="space-y-4">
          {!selected && !loading && (
            <GlassCard><p className="text-sm text-muted-foreground">Selectează o regulă din listă.</p></GlassCard>
          )}
          {selected && (
            <>
              <GlassCard>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{selected.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATE_COLORS[selected.state]}`}>
                        {selected.state}
                      </span>
                      <span className="admin-mono text-[10px] text-muted-foreground">v{selected.version}</span>
                    </div>
                    <p className="admin-mono mt-0.5 text-[11px] text-primary/80">{selected.code}</p>
                    {selected.description && (
                      <p className="mt-2 text-xs text-muted-foreground">{selected.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <ActionBtn label="Draft" icon={GitBranch} onClick={() => onChangeState("draft")} active={selected.state === "draft"} />
                    <ActionBtn label="Shadow" icon={FlaskConical} onClick={() => onChangeState("shadow")} active={selected.state === "shadow"} />
                    <ActionBtn label="Enforce" icon={ShieldCheck} onClick={() => onChangeState("enforcing")} active={selected.state === "enforcing"} danger />
                    <ActionBtn label="Archive" icon={Archive} onClick={() => onChangeState("archived")} active={selected.state === "archived"} />
                    <ActionBtn label="Editează" icon={Play} onClick={() => { setCreating(false); setEditorOpen(true); }} />
                  </div>
                </div>
              </GlassCard>

              <div className="grid gap-4 md:grid-cols-2">
                <JsonView title="Expression" data={selected.expression} />
                <JsonView title="Action" data={selected.action} />
              </div>

              <SimulatorCard code={selected.code} simulate={simulate} />
              <RecentEvalsCard code={selected.code} recent={recent} />
              <VersionsCard ruleId={selected.id} listVersions={listVersions} />
            </>
          )}
        </div>
      </div>

      {editorOpen && (
        <RuleEditor
          initial={creating ? null : selected}
          onClose={() => setEditorOpen(false)}
          onSave={async (payload) => {
            try {
              await upsert({ data: payload });
              toast.success("Regulă salvată");
              setEditorOpen(false); load();
            } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
          }}
        />
      )}
    </div>
  );
}

function ActionBtn({ label, icon: Icon, onClick, active, danger }: {
  label: string; icon: typeof Play; onClick: () => void; active?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
        active ? "border-primary/60 bg-primary/15 text-primary"
          : danger ? "border-red-500/40 bg-red-500/5 text-red-300 hover:bg-red-500/10"
          : "border-border/60 bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}

function JsonView({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <GlassCard>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <pre className="admin-mono overflow-auto rounded-lg bg-background/60 p-3 text-[11px] text-primary/90 max-h-64">
{JSON.stringify(data, null, 2)}
      </pre>
    </GlassCard>
  );
}

function SimulatorCard({ code, simulate }: { code: string; simulate: ReturnType<typeof useServerFn<typeof policySimulate>> }) {
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<{ total: number; matched: number; matchRate: number; byDay: Array<{ day: string; total: number; matched: number }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setErr(null);
    try { setResult(await simulate({ data: { ruleCode: code, days } })); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-primary" />
        <p className="text-sm font-semibold">Simulator / Backtest</p>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-border/60 bg-surface/60 px-2 py-1 text-xs"
          >
            {[1, 7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>ultimele {d} zile</option>)}
          </select>
          <button
            onClick={run} disabled={busy}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />} Rulează
          </button>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
      {result && (
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Metric label="Total evaluări" value={result.total.toLocaleString("ro-RO")} />
          <Metric label="Match" value={result.matched.toLocaleString("ro-RO")} />
          <Metric label="Match rate" value={`${result.matchRate}%`} accent />
        </div>
      )}
      {result && result.byDay.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Distribuție zilnică</p>
          <div className="flex items-end gap-1 h-16">
            {result.byDay.map((d) => {
              const max = Math.max(...result.byDay.map((x) => x.total), 1);
              const pct = (d.total / max) * 100;
              const matchPct = d.total > 0 ? (d.matched / d.total) * 100 : 0;
              return (
                <div key={d.day} className="relative flex-1 rounded-sm bg-surface/60" style={{ height: `${pct}%` }}
                     title={`${d.day.slice(0, 10)} · ${d.matched}/${d.total}`}>
                  <div className="absolute inset-x-0 bottom-0 rounded-sm bg-primary/80" style={{ height: `${matchPct}%` }} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 bg-surface/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`admin-mono mt-1 text-lg font-semibold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function RecentEvalsCard({ code, recent }: { code: string; recent: ReturnType<typeof useServerFn<typeof policyRecentEvaluations>> }) {
  const [rows, setRows] = useState<Array<{ id: number; rule_version: number; mode: string; subject_kind: string; subject_id: string | null; matched: boolean; action_taken: string | null; created_at: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { setRows(await recent({ data: { ruleCode: code, limit: 20 } }) as any); }
    finally { setBusy(false); }
  }, [code, recent]);
  useEffect(() => { void load(); }, [load]);
  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">Evaluări recente</p>
        <button onClick={load} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
        </button>
      </div>
      {(!rows || rows.length === 0) ? (
        <p className="mt-2 text-xs text-muted-foreground">Nicio evaluare încă. Instrumentează codul cu inserturi în <code>policy_evaluations</code>.</p>
      ) : (
        <div className="mt-2 max-h-60 overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr><th className="text-left py-1">Când</th><th>Mod</th><th>Subiect</th><th>Match</th><th>Acțiune</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="py-1 admin-mono text-[10px]">{new Date(r.created_at).toLocaleString("ro-RO")}</td>
                  <td className="text-center"><StatusBadge kind={r.mode === "enforcing" ? "danger" : "info"}>{r.mode}</StatusBadge></td>
                  <td className="admin-mono text-[10px] truncate max-w-[140px]">{r.subject_kind}:{r.subject_id?.slice(0, 8)}</td>
                  <td className="text-center">{r.matched ? "✓" : "—"}</td>
                  <td className="text-[10px] text-muted-foreground">{r.action_taken ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

function VersionsCard({ ruleId, listVersions }: { ruleId: string; listVersions: ReturnType<typeof useServerFn<typeof policyListVersions>> }) {
  const [rows, setRows] = useState<Array<{ version: number; state: string; change_note: string | null; created_at: string }> | null>(null);
  useEffect(() => {
    (async () => {
      try { setRows(await listVersions({ data: { ruleId } }) as any); } catch { /* ignore */ }
    })();
  }, [ruleId, listVersions]);
  return (
    <GlassCard>
      <p className="mb-2 text-sm font-semibold">Istoric versiuni</p>
      {(!rows || rows.length === 0) ? (
        <p className="text-xs text-muted-foreground">O singură versiune.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {rows.map((v) => (
            <li key={v.version} className="flex items-center gap-2 border-t border-border/40 py-1">
              <span className="admin-mono">v{v.version}</span>
              <span className="text-muted-foreground">{v.state}</span>
              <span className="ml-auto admin-mono text-[10px] text-muted-foreground">
                {new Date(v.created_at).toLocaleString("ro-RO")}
              </span>
              {v.change_note && <span className="text-muted-foreground">— {v.change_note}</span>}
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function RuleEditor({ initial, onClose, onSave }: {
  initial: Rule | null; onClose: () => void;
  onSave: (payload: { code: string; category: string; title: string; description: string; expression: Record<string, unknown>; action: Record<string, unknown>; changeNote?: string }) => Promise<void>;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [category, setCategory] = useState(initial?.category ?? "moderation");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [exprText, setExprText] = useState(JSON.stringify(initial?.expression ?? { "when": { "field": "risk_score", "op": ">=", "value": 70 } }, null, 2));
  const [actionText, setActionText] = useState(JSON.stringify(initial?.action ?? { "type": "flag", "queue": "risk_review" }, null, 2));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    let expression: Record<string, unknown>, action: Record<string, unknown>;
    try { expression = JSON.parse(exprText); } catch { toast.error("Expression: JSON invalid"); return; }
    try { action = JSON.parse(actionText); } catch { toast.error("Action: JSON invalid"); return; }
    setSaving(true);
    try {
      await onSave({ code, category, title, description, expression, action, changeNote: note || undefined });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-primary/30 bg-surface p-6 shadow-2xl max-h-[92vh] overflow-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <Scale className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">{initial ? `Editează ${initial.code}` : "Regulă nouă"}</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Cod (unic, kebab)">
            <input value={code} onChange={(e) => setCode(e.target.value)} disabled={!!initial}
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm admin-mono disabled:opacity-60" />
          </Field>
          <Field label="Categorie">
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
              {["moderation", "risk", "anti_spam", "pricing", "notification", "trust_safety", "compliance"].map((c) =>
                <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Titlu" full>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm" />
          </Field>
          <Field label="Descriere" full>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="Expression (JSON)" full>
            <Textarea value={exprText} onChange={(e) => setExprText(e.target.value)} rows={6}
              className="admin-mono text-[11px]" />
          </Field>
          <Field label="Action (JSON)" full>
            <Textarea value={actionText} onChange={(e) => setActionText(e.target.value)} rows={5}
              className="admin-mono text-[11px]" />
          </Field>
          <Field label="Notă modificare (audit)" full>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: prag ajustat de la 60 la 70 după alertă false-positive"
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm" />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border/60 px-4 py-2 text-sm">Anulează</button>
          <button onClick={submit} disabled={saving || !code || !title}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="size-3.5 animate-spin" />} Salvează
          </button>
        </div>
        {!initial && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Regula intră implicit în <b>draft</b>. Promovează în <b>shadow</b> pentru a evalua fără efect, apoi în <b>enforcing</b>.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
