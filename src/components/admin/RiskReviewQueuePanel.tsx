import { Fragment as FragmentRow, useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


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
function parseNotes(details: RiskFlagDetails | null): NoteEntry[] {
  const log = details?.notes_log;
  return Array.isArray(log) ? log : [];
}

// Friendly labels for risk signal flags emitted by public.compute_user_risk.
const FLAG_LABEL: Record<string, { label: string; weight: string }> = {
  duplicate_fingerprint:      { label: "Fingerprint duplicat",       weight: "+15…40" },
  rapid_signup:               { label: "Signup rapid (24h)",         weight: "+10…25" },
  no_verification:            { label: "Vârstă neverificată",        weight: "+15"    },
  no_photos:                  { label: "Fără poze",                  weight: "+10"    },
  multiple_reports:           { label: "Rapoarte deschise multiple", weight: "+15…40" },
  spam_messages_new_account:  { label: "Spam mesaje (cont nou)",     weight: "+20"    },
  spam_messages:              { label: "Spam mesaje",                weight: "+15"    },
};

const SIGNAL_LABEL: Record<string, string> = {
  duplicate_fingerprint_users: "useri cu același fingerprint",
  rapid_signup_24h:            "conturi noi din același device (24h)",
  age_status:                  "status verificare vârstă",
  open_reports:                "rapoarte deschise primite",
  messages_1h:                 "mesaje trimise în ultima oră",
};

function flagsFromDetails(d: RiskFlagDetails | null): string[] {
  if (!d) return [];
  const direct = Array.isArray(d.flags) ? d.flags : [];
  const nested = Array.isArray(d.signals?.flags) ? (d.signals!.flags as string[]) : [];
  // Deduplicate while preserving order
  return Array.from(new Set([...direct, ...nested]));
}

function signalEntries(d: RiskFlagDetails | null): Array<[string, unknown]> {
  if (!d?.signals) return [];
  return Object.entries(d.signals).filter(([k]) => k !== "flags");
}

export function RiskReviewQueuePanel() {
  const listFn = useServerFn(adminListNewAccountReviewQueue);
  const resolveFn = useServerFn(adminResolveRiskFlag);
  const addNoteFn = useServerFn(adminAddRiskFlagNote);
  const setStatusFn = useServerFn(adminSetRiskFlagStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | {
    flagId: string;
    decision: "cleared" | "false_positive" | "escalated";
    userLabel: string;
    note: string;
  }>(null);

  // Filters & pagination
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState<"all" | "critic" | "inalt" | "mediu">("all");
  const [windowFilter, setWindowFilter] = useState<"1h" | "24h" | "7d" | "all">("all");
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  const [state, reload, lastLoadedAt] = useAdminPanelLoad<ReviewQueueRow[]>(async () => {
    const { rows } = await listFn({ data: { limit: 200 } });
    return rows;
  }, [], { autoRefreshMs: 30_000 });

  const baseRows = state.status === "ready" ? state.data.filter((r) => !resolvedIds.has(r.flag_id)) : [];

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const windowMs = windowFilter === "1h" ? 3_600_000
      : windowFilter === "24h" ? 86_400_000
      : windowFilter === "7d" ? 7 * 86_400_000
      : null;
    return baseRows.filter((r) => {
      if (q) {
        const hay = `${r.display_name ?? ""} ${r.user_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sevFilter !== "all") {
        const s = r.severity ?? 0;
        if (sevFilter === "critic" && s < 3) return false;
        if (sevFilter === "inalt" && (s < 2 || s >= 3)) return false;
        if (sevFilter === "mediu" && s >= 2) return false;
      }
      if (windowMs !== null) {
        const t = r.flag_created_at ? new Date(r.flag_created_at).getTime() : 0;
        if (!t || now - t > windowMs) return false;
      }
      return true;
    });
  }, [baseRows, search, sevFilter, windowFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters or data shrink past current page
  useEffect(() => { setPage(1); }, [search, sevFilter, windowFilter]);

  const filtersActive = !!(search || sevFilter !== "all" || windowFilter !== "all");
  function resetFilters() { setSearch(""); setSevFilter("all"); setWindowFilter("all"); }


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

  const DECISION_META: Record<"cleared" | "false_positive" | "escalated", { title: string; desc: string; ok: string; toast: string; noteRequired: boolean; tone: "default" | "destructive" }> = {
    cleared:        { title: "Curăță flag-ul",       desc: "Marchează contul ca legitim. Flag-ul iese din coadă, dar rămâne în istoric.", ok: "Curăță",        toast: "Flag curățat — cont marcat legitim", noteRequired: false, tone: "default" },
    false_positive: { title: "Marchează fals pozitiv", desc: "Semnalele nu reflectă risc real. Util pentru calibrare ulterioară.",         ok: "Fals pozitiv",  toast: "Marcat ca fals pozitiv",            noteRequired: false, tone: "default" },
    escalated:      { title: "Escaladează spre Trust & Safety", desc: "Necesită investigație suplimentară. Nota e obligatorie pentru audit.", ok: "Escaladează",   toast: "Escaladat către Trust & Safety",    noteRequired: true,  tone: "destructive" },
  };

  function openConfirm(flagId: string, decision: "cleared" | "false_positive" | "escalated", userLabel: string) {
    setConfirm({ flagId, decision, userLabel, note: "" });
  }

  async function runResolve() {
    if (!confirm) return;
    const { flagId, decision, note } = confirm;
    const meta = DECISION_META[decision];
    const trimmed = note.trim();
    if (meta.noteRequired && trimmed.length < 3) {
      toast.error("Nota e obligatorie pentru escaladare (min. 3 caractere).");
      return;
    }
    setBusy(flagId);
    setConfirm(null);
    // Optimistic hide
    setResolvedIds((s) => { const n = new Set(s); n.add(flagId); return n; });
    try {
      await resolveFn({ data: { flagId, decision, notes: trimmed || undefined } });
      toast.success(meta.toast, { description: `Flag ${flagId.slice(0, 8)}…` });
      reload();
    } catch (e) {
      // Rollback optimistic hide
      setResolvedIds((s) => { const n = new Set(s); n.delete(flagId); return n; });
      toast.error("Eroare la salvare", { description: e instanceof Error ? e.message : String(e) });
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

      {/* Filter bar */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută nume sau UUID..."
          className="flex-1 min-w-[180px] rounded-md border border-white/10 bg-black/30 px-2 py-1.5"
        />
        <select
          value={sevFilter}
          onChange={(e) => setSevFilter(e.target.value as typeof sevFilter)}
          className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5"
        >
          <option value="all">Toate severitățile</option>
          <option value="critic">Critic</option>
          <option value="inalt">Înalt</option>
          <option value="mediu">Mediu</option>
        </select>
        <select
          value={windowFilter}
          onChange={(e) => setWindowFilter(e.target.value as typeof windowFilter)}
          className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5"
        >
          <option value="all">Orice perioadă</option>
          <option value="1h">Ultima oră</option>
          <option value="24h">Ultimele 24h</option>
          <option value="7d">Ultimele 7 zile</option>
        </select>
        <span className="text-muted-foreground">
          {filteredRows.length}
          {filtersActive && baseRows.length !== filteredRows.length && <> / {baseRows.length}</>}
          {" "}rânduri
        </span>
        {filtersActive && (
          <button
            onClick={resetFilters}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 hover:bg-white/10"
          >
            Reset
          </button>
        )}
      </div>

      <PanelStatus
        state={state}
        isEmpty={state.status === "ready" && filteredRows.length === 0}
        emptyHint={
          baseRows.length === 0
            ? "empty legitim — niciun cont nou nu a depășit pragul de risc."
            : "Niciun rezultat pentru filtrele curente."
        }
        retry={reload}
      >
        {state.status === "ready" && pagedRows.length > 0 && (
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
                {pagedRows.map((r) => {
                  const notes = parseNotes(r.details);
                  const flags = flagsFromDetails(r.details);
                  const signals = signalEntries(r.details);
                  const reason = r.details?.reason ?? null;
                  const ageH = typeof r.details?.account_age_hours === "number"
                    ? Math.round((r.details!.account_age_hours as number) * 10) / 10
                    : null;
                  const isOpen = expanded === r.flag_id;
                  return (
                  <FragmentRow key={r.flag_id}>
                  <tr className="border-t border-white/5">

                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{r.display_name ?? "(fără nume)"}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.user_id}</div>
                      {flags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {flags.slice(0, 4).map((f) => (
                            <span
                              key={f}
                              title={FLAG_LABEL[f]?.weight ? `Contribuție scor: ${FLAG_LABEL[f].weight}` : f}
                              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200"
                            >
                              {FLAG_LABEL[f]?.label ?? f}
                            </span>
                          ))}
                          {flags.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{flags.length - 4}</span>
                          )}
                        </div>
                      )}
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
                          onClick={() => openConfirm(r.flag_id, "cleared", r.display_name ?? r.user_id)}
                          title="Curăță (legitim)"
                          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {busy === r.flag_id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        </button>
                        <button
                          disabled={busy === r.flag_id}
                          onClick={() => openConfirm(r.flag_id, "false_positive", r.display_name ?? r.user_id)}
                          title="Fals pozitiv"
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          <X className="size-3" />
                        </button>
                        <button
                          disabled={busy === r.flag_id}
                          onClick={() => openConfirm(r.flag_id, "escalated", r.display_name ?? r.user_id)}
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
                        <div className="space-y-3">
                          <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                            <div className="text-xs font-medium text-amber-200 flex items-center gap-1">
                              <Activity className="size-3" /> Semnale care au generat alerta
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Scor calculat: <span className="font-semibold text-foreground">{r.details?.risk_score ?? r.risk_score}</span>
                              {ageH !== null && <> · vechime cont la flagging: <span className="text-foreground">{ageH}h</span></>}
                              {reason && <> · {reason}</>}
                            </div>
                            {flags.length === 0 ? (
                              <div className="mt-2 text-[11px] text-muted-foreground italic">
                                Niciun flag detaliat înregistrat (scor agregat).
                              </div>
                            ) : (
                              <ul className="mt-2 space-y-1">
                                {flags.map((f) => {
                                  const meta = FLAG_LABEL[f];
                                  return (
                                    <li key={f} className="flex items-center justify-between gap-2 text-[11px]">
                                      <span className="flex items-center gap-1.5">
                                        <span className="size-1.5 rounded-full bg-amber-400" />
                                        <span className="font-medium">{meta?.label ?? f}</span>
                                        <span className="font-mono text-[10px] text-muted-foreground">{f}</span>
                                      </span>
                                      <span className="text-[10px] text-amber-300/80">{meta?.weight ?? ""}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {signals.length > 0 && (
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {signals.map(([k, v]) => (
                                  <div key={k} className="flex items-center justify-between rounded border border-white/5 bg-black/20 px-2 py-1 text-[11px]">
                                    <span className="text-muted-foreground">{SIGNAL_LABEL[k] ?? k}</span>
                                    <span className="font-mono text-foreground">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

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

        {state.status === "ready" && filteredRows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              Pagina {safePage} din {totalPages} · {filteredRows.length} rezultate
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10 disabled:opacity-40"
              >
                ‹ Anterior
              </button>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10 disabled:opacity-40"
              >
                Următor ›
              </button>
            </div>
          </div>
        )}
      </PanelStatus>


      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          {confirm && (() => {
            const meta = DECISION_META[confirm.decision];
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{meta.title}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Utilizator: <span className="font-medium text-foreground">{confirm.userLabel}</span>
                    <br />
                    {meta.desc}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Notă {meta.noteRequired ? <span className="text-red-400">(obligatorie)</span> : <span>(opțional)</span>}
                  </label>
                  <textarea
                    autoFocus
                    value={confirm.note}
                    onChange={(e) => setConfirm((c) => c ? { ...c, note: e.target.value } : c)}
                    rows={3}
                    placeholder={meta.noteRequired ? "Motiv escaladare, context, link investigație..." : "Context intern (opțional)..."}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anulează</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={runResolve}
                    className={meta.tone === "destructive" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                  >
                    {meta.ok}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

}
