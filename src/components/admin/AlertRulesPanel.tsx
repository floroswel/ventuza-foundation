import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, PlayCircle, PlusCircle, Save, Trash2, X } from "lucide-react";
import {
  adminListAlertRules,
  adminUpsertAlertRule,
  adminDeleteAlertRule,
  adminToggleAlertRule,
  adminSimulateAlertRule,
} from "@/lib/admin-enterprise.functions";

type Rule = {
  id: number;
  name: string;
  description: string | null;
  event_kind: string;
  condition: Record<string, unknown>;
  threshold: number;
  window_seconds: number;
  severity: "info" | "warn" | "high" | "critical";
  destination: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

const SEV_COLOR: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  warn: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  critical: "bg-red-500/15 text-red-500 border-red-500/30",
};

function humanWindow(sec: number): string {
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

const EMPTY_RULE: Partial<Rule> = {
  name: "",
  description: "",
  event_kind: "",
  condition: {},
  threshold: 1,
  window_seconds: 3600,
  severity: "warn",
  destination: {},
  enabled: true,
};

export function AlertRulesPanel() {
  const list = useServerFn(adminListAlertRules);
  const upsert = useServerFn(adminUpsertAlertRule);
  const del = useServerFn(adminDeleteAlertRule);
  const toggle = useServerFn(adminToggleAlertRule);
  const simulate = useServerFn(adminSimulateAlertRule);

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Rule> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const [sim, setSim] = useState<{ matches: number; would_fire: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      setRules((await list()) as Rule[]);
    } catch (e: any) {
      setError(e?.message ?? "Nu am putut încărca regulile");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const eventKinds = useMemo(
    () => Array.from(new Set(rules.map((r) => r.event_kind))).sort(),
    [rules],
  );

  const save = async () => {
    if (!editing || !editing.name || !editing.event_kind) {
      toast.error("Nume și event_kind sunt obligatorii");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        id: editing.id,
        name: editing.name,
        description: editing.description || null,
        event_kind: editing.event_kind,
        condition: editing.condition ?? {},
        threshold: Number(editing.threshold ?? 1),
        window_seconds: Number(editing.window_seconds ?? 3600),
        severity: editing.severity ?? "warn",
        destination: editing.destination ?? {},
        enabled: editing.enabled ?? true,
      };
      await upsert({ data: payload });
      toast.success(editing.id ? "Regulă actualizată" : "Regulă creată");
      setEditing(null);
      setSim(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setSaving(false);
    }
  };

  const doSimulate = async () => {
    if (!editing?.event_kind) {
      toast.error("Alege event_kind");
      return;
    }
    try {
      const r = await simulate({
        data: {
          event_kind: editing.event_kind,
          window_seconds: Number(editing.window_seconds ?? 3600),
          threshold: Number(editing.threshold ?? 1),
        },
      });
      setSim({ matches: r.matches, would_fire: r.would_fire });
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare simulare");
    }
  };

  const doToggle = async (r: Rule) => {
    try {
      await toggle({ data: { id: r.id, enabled: !r.enabled } });
      setRules((cur) => cur.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    }
  };

  const confirmDelete = async (_reason: string) => {
    if (!deleteTarget) return;
    try {
      await del({ data: { id: deleteTarget.id } });
      setRules((cur) => cur.filter((x) => x.id !== deleteTarget.id));
      toast.success("Regulă ștearsă");
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Reguli alerte</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rules.length} reguli</span>
        <button
          onClick={() => {
            setEditing({ ...EMPTY_RULE });
            setSim(null);
          }}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <PlusCircle className="mr-1 inline size-3" /> Regulă nouă
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
          <button
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="ml-3 rounded-full border border-red-500/40 px-2 py-0.5 text-red-300 hover:bg-red-500/10"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
          Se încarcă…
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nicio regulă activă. Creează una pentru a primi alerte automate când un tip de eveniment
          depășește pragul.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Nume</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Prag / Fereastră</th>
                <th className="px-3 py-2 text-left">Severitate</th>
                <th className="px-3 py-2 text-center">Activ</th>
                <th className="px-3 py-2 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.event_kind}</td>
                  <td className="px-3 py-2 text-xs">
                    ≥ {r.threshold} / {humanWindow(r.window_seconds)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${SEV_COLOR[r.severity]}`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => doToggle(r)}
                      className={`rounded-full px-2 py-0.5 text-xs ${r.enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.enabled ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => {
                        setEditing(r);
                        setSim(null);
                      }}
                      className="mr-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface"
                    >
                      Editează
                    </button>
                    <button
                      onClick={() => setDeleteTarget(r)}
                      className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-500 hover:bg-red-500/20"
                    >
                      <Trash2 className="inline size-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {editing.id ? "Editează regula" : "Regulă nouă"}
              </h3>
              <button
                onClick={() => {
                  setEditing(null);
                  setSim(null);
                }}
                className="rounded-full p-1 hover:bg-surface"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">Nume *</span>
                <input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="Ex: Rapoarte multiple în 1h"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">Event kind *</span>
                <input
                  value={editing.event_kind ?? ""}
                  onChange={(e) => setEditing({ ...editing, event_kind: e.target.value })}
                  list="event-kinds"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono"
                  placeholder="fingerprint_cluster"
                />
                <datalist id="event-kinds">
                  {eventKinds.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </label>
              <label className="col-span-1 md:col-span-2 text-xs">
                <span className="mb-1 block text-muted-foreground">Descriere</span>
                <input
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">Prag (≥)</span>
                <input
                  type="number"
                  min={1}
                  value={editing.threshold ?? 1}
                  onChange={(e) => setEditing({ ...editing, threshold: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">Fereastră (secunde)</span>
                <input
                  type="number"
                  min={60}
                  value={editing.window_seconds ?? 3600}
                  onChange={(e) =>
                    setEditing({ ...editing, window_seconds: Number(e.target.value) })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">Severitate</span>
                <select
                  value={editing.severity ?? "warn"}
                  onChange={(e) =>
                    setEditing({ ...editing, severity: e.target.value as Rule["severity"] })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">Activă</span>
                <select
                  value={String(editing.enabled ?? true)}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.value === "true" })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="true">ON</option>
                  <option value="false">OFF</option>
                </select>
              </label>
            </div>
            {sim && (
              <div
                className={`mt-3 rounded-lg border p-3 text-xs ${sim.would_fire ? "border-orange-500/40 bg-orange-500/10 text-orange-500" : "border-border bg-surface text-muted-foreground"}`}
              >
                Simulare pe ultima fereastră: <strong>{sim.matches}</strong> match-uri.
                {sim.would_fire ? " Regula S-AR DECLANȘA." : " Sub prag, NU s-ar declanșa."}
              </div>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={doSimulate}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface"
              >
                <PlayCircle className="mr-1 inline size-3" /> Simulează
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setSim(null);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface"
              >
                Anulează
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Save className="mr-1 inline size-3" /> {saving ? "Salvez…" : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl">
            <h3 className="text-base font-semibold text-red-500">Șterge regula</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Vei șterge definitiv regula „{deleteTarget.name}". Acțiune permanentă și logată în
              audit.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface"
              >
                Anulează
              </button>
              <button
                onClick={() => confirmDelete("delete rule")}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
              >
                Șterge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
