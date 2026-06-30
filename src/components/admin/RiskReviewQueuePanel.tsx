import { Fragment as FragmentRow, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Check, X, RefreshCw, Flag, Loader2, MessageSquarePlus, Clock, History, Activity } from "lucide-react";
import { useAdminPanelLoad, PanelStatus, LastCheckBadge } from "@/components/admin/PanelStatus";
import {
  adminListNewAccountReviewQueue,
  adminResolveRiskFlag,
  adminAddRiskFlagNote,
  adminSetRiskFlagStatus,
  type ReviewQueueRow,
  type RiskFlagDetails,
} from "@/lib/risk-queue.functions";
import { toast } from "sonner";


function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function scoreTone(score: number) {
  if (score >= 80) return "bg-red-500/20 text-red-300 border-red-500/40";
  if (score >= 60) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
}

function severityLabel(s: number) {
  return s >= 3 ? "Critic" : s >= 2 ? "Înalt" : "Mediu";
}

type NoteEntry = { actor?: string; at?: string; note?: string; status_change?: { from?: string; to?: string } };
function parseNotes(details: string | null): NoteEntry[] {
  if (!details) return [];
  try {
    const obj = JSON.parse(details);
    const log = obj?.notes_log;
    return Array.isArray(log) ? (log as NoteEntry[]) : [];
  } catch { return []; }
}

export function RiskReviewQueuePanel() {
  const listFn = useServerFn(adminListNewAccountReviewQueue);
  const resolveFn = useServerFn(adminResolveRiskFlag);
  const addNoteFn = useServerFn(adminAddRiskFlagNote);
  const setStatusFn = useServerFn(adminSetRiskFlagStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const [state, reload, lastLoadedAt] = useAdminPanelLoad<ReviewQueueRow[]>(async () => {
    const { rows } = await listFn({ data: { limit: 200 } });
    return rows;
  }, [], { autoRefreshMs: 30_000 });

  // Live refresh on new flags
  useEffect(() => {
    const ch = supabase
      .channel("risk_review_queue_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "risk_flags" },
        () => reload(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);

  async function resolve(flagId: string, decision: "cleared" | "false_positive" | "escalated") {
    const notes = decision === "escalated"
      ? (window.prompt("Note (escaladare):") ?? undefined)
      : undefined;
    if (decision === "escalated" && !notes) return;
    setBusy(flagId);
    try {
      await resolveFn({ data: { flagId, decision, notes } });
      toast.success(
        decision === "escalated" ? "Escaladat" :
        decision === "false_positive" ? "Marcat fals pozitiv" : "Curățat",
      );
      reload();
    } catch (e) {
      toast.error("Eroare: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function markInProgress(flagId: string) {
    setBusy(flagId);
    try {
      await setStatusFn({ data: { flagId, status: "in_progress" } });
      toast.success("Marcat în curs");
      reload();
    } catch (e) {
      toast.error("Eroare: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(null); }
  }

  async function submitNote(flagId: string) {
    const note = (noteDraft[flagId] ?? "").trim();
    if (!note) { toast.error("Nota nu poate fi goală"); return; }
    setBusy(flagId);
    try {
      await addNoteFn({ data: { flagId, note } });
      setNoteDraft((d) => ({ ...d, [flagId]: "" }));
      toast.success("Notă adăugată");
      reload();
    } catch (e) {
      toast.error("Eroare: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(null); }
  }


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Flag className="size-5 text-amber-400" />
            Coadă review — conturi noi cu risc ridicat
            <LastCheckBadge at={lastLoadedAt} />
          </h2>
          <p className="text-xs text-muted-foreground">
            Auto-flag la scor ≥60 pentru conturi create în ultimele 7 zile. Decide: curăță, fals pozitiv sau escaladează.
          </p>
        </div>
        <button
          onClick={() => reload()}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-1"
        >
          <RefreshCw className="size-3.5" /> Reîncarcă
        </button>
      </div>

      <PanelStatus
        state={state}
        isEmpty={state.status === "ready" && state.data.length === 0}
        emptyHint="empty legitim — niciun cont nou nu a depășit pragul de risc."
        retry={reload}
      >
        {state.status === "ready" && state.data.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Utilizator</th>
                  <th className="px-3 py-2 text-left">Scor</th>
                  <th className="px-3 py-2 text-left">Severitate</th>
                  <th className="px-3 py-2 text-left">Vechime cont</th>
                  <th className="px-3 py-2 text-left">Pus în coadă</th>
                  <th className="px-3 py-2 text-left">Status user</th>
                  <th className="px-3 py-2 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((r) => {
                  const notes = parseNotes(r.details);
                  const isOpen = expanded === r.flag_id;
                  return (
                  <FragmentRow key={r.flag_id}>
                  <tr className="border-t border-white/5">

                    <td className="px-3 py-2">
                      <div className="font-medium">{r.display_name ?? "(fără nume)"}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.user_id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${scoreTone(r.risk_score)}`}>
                        <AlertTriangle className="size-3" /> {r.risk_score}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{severityLabel(r.severity)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(r.account_created_at)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(r.flag_created_at)}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.banned_at ? <span className="text-red-300">banat</span>
                        : r.suspended_until && new Date(r.suspended_until) > new Date()
                          ? <span className="text-amber-300">suspendat</span>
                          : r.verified ? <span className="text-emerald-300">verificat</span>
                            : <span className="text-muted-foreground">activ</span>}
                      {r.report_count > 0 && (
                        <span className="ml-1 text-red-300">· {r.report_count} rap.</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <button
                          disabled={busy === r.flag_id}
                          onClick={() => setExpanded(isOpen ? null : r.flag_id)}
                          title={`Note (${notes.length})`}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50 flex items-center gap-1"
                        >
                          <History className="size-3" /> {notes.length}
                        </button>
                        <button
                          disabled={busy === r.flag_id}
                          onClick={() => markInProgress(r.flag_id)}
                          title="Marchează în curs de investigare"
                          className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
                        >
                          <Clock className="size-3" />
                        </button>
                        <button
                          disabled={busy === r.flag_id}
                          onClick={() => resolve(r.flag_id, "cleared")}
                          title="Curăță (legitim)"
                          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {busy === r.flag_id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        </button>
                        <button
                          disabled={busy === r.flag_id}
                          onClick={() => resolve(r.flag_id, "false_positive")}
                          title="Fals pozitiv"
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          <X className="size-3" />
                        </button>
                        <button
                          disabled={busy === r.flag_id}
                          onClick={() => resolve(r.flag_id, "escalated")}
                          title="Escaladează"
                          className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <AlertTriangle className="size-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={r.flag_id + "-notes"} className="border-t border-white/5 bg-black/20">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <History className="size-3" /> Istoric note ({notes.length})
                          </div>
                          {notes.length === 0 ? (
                            <div className="text-xs text-muted-foreground italic">Nicio notă încă.</div>
                          ) : (
                            <ul className="space-y-1.5 max-h-60 overflow-auto">
                              {notes.map((n, i) => (
                                <li key={i} className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs">
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span className="font-mono">{(n.actor ?? "—").slice(0, 8)}</span>
                                    <span>{fmt(n.at ?? null)}</span>
                                    {n.status_change && (
                                      <span className="rounded bg-sky-500/20 px-1 text-sky-300">
                                        {n.status_change.from} → {n.status_change.to}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 whitespace-pre-wrap">{n.note}</div>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex items-start gap-2 pt-1">
                            <textarea
                              value={noteDraft[r.flag_id] ?? ""}
                              onChange={(e) => setNoteDraft((d) => ({ ...d, [r.flag_id]: e.target.value }))}
                              placeholder="Adaugă o notă internă (audit-logged)…"
                              maxLength={2000}
                              rows={2}
                              className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs resize-y"
                            />
                            <button
                              disabled={busy === r.flag_id}
                              onClick={() => submitNote(r.flag_id)}
                              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1 self-start"
                            >
                              <MessageSquarePlus className="size-3" /> Trimite
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </FragmentRow>
                  );
                })}

              </tbody>
            </table>
          </div>
        )}
      </PanelStatus>
    </div>
  );
}
