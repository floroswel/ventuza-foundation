import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { AdminErrorBanner } from "./AdminErrorBanner";
import {
  adminListTickets,
  adminTicketStats,
  getTicketThread,
  replyToTicket,
  adminTicketAction,
  adminBulkTicketAction,
} from "@/lib/admin-support.functions";
import { getSlaThresholds, listQueueClaims } from "@/lib/admin-queue.functions";
import { GlassCard, Kpi, SectionTitle, StatusBadge } from "@/components/admin/ui/primitives";
import { SlaBadge, type SlaThreshold } from "@/components/admin/queue/SlaBadge";
import { ClaimBadge } from "@/components/admin/queue/ClaimBadge";
import { useQueueClaim } from "@/components/admin/queue/useQueueClaim";
import { useKeyboardShortcuts, ShortcutsHint } from "@/components/admin/queue/useKeyboardShortcuts";
import { pushAction } from "@/components/admin/queue/useActionJournal";
import { SavedViewsBar } from "@/components/admin/SavedViewsBar";
import { useSavedViews } from "@/hooks/useSavedViews";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/admin/ui/BulkActionBar";
import { ReasonDialog } from "@/components/admin/ReasonDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type SupportFilters = {
  status: "open" | "pending" | "waiting_user" | "resolved" | "closed" | "all";
  priority: "low" | "normal" | "high" | "urgent" | "all";
  search: string;
};

type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  last_msg_at: string | null;
  created_at: string;
  display_name?: string;
};
type Msg = {
  id: string;
  author_id: string;
  author_role: string;
  body: string;
  internal_note: boolean;
  created_at: string;
};

const STATUS_TONE: Record<string, "pending" | "approved" | "rejected" | "neutral"> = {
  open: "pending",
  pending: "pending",
  waiting_user: "neutral",
  resolved: "approved",
  closed: "neutral",
};
const PRIO_TONE: Record<string, "pending" | "rejected" | "neutral" | "approved"> = {
  low: "neutral",
  normal: "neutral",
  high: "pending",
  urgent: "rejected",
};

export function SupportTicketsPanel() {
  const list = useServerFn(adminListTickets);
  const stats = useServerFn(adminTicketStats);
  const slaFn = useServerFn(getSlaThresholds);
  const claimsFn = useServerFn(listQueueClaims);

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [kpi, setKpi] = useState<{
    open: number;
    urgent: number;
    unassigned: number;
    waiting: number;
  } | null>(null);
  const [status, setStatus] = useState<
    "open" | "pending" | "waiting_user" | "resolved" | "closed" | "all"
  >("open");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent" | "all">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slaError, setSlaError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [sla, setSla] = useState<SlaThreshold | undefined>();
  const [claims, setClaims] = useState<
    Record<string, { actor_id: string; display_name: string; expires_at: string }>
  >({});
  const [meId, setMeId] = useState<string | undefined>();
  const bulk = useBulkSelection(rows);
  const bulkFn = useServerFn(adminBulkTicketAction);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkPriority, setBulkPriority] = useState<string>("");

  // Saved views: restore-once la mount + expose bar
  const savedViews = useSavedViews<SupportFilters>("admin.support");
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (savedViews.active) {
      const f = savedViews.active.filters;
      setStatus(f.status);
      setPriority(f.priority);
      setSearch(f.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedViews.active?.id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id));
  }, []);
  useEffect(() => {
    setSlaError(null);
    slaFn()
      .then((all) => setSla(all?.support))
      .catch((e: any) => {
        setSla(undefined);
        setSlaError(e?.message ?? "Nu am putut încărca pragurile SLA");
      });
  }, [slaFn]);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const [r, k, cl] = await Promise.all([
        list({ data: { status, priority, search: search || undefined, limit: 100 } }),
        stats(),
        claimsFn({ data: { queue: "support" } }),
      ]);
      setRows(r.rows as TicketRow[]);
      setKpi(k);
      const map: Record<string, { actor_id: string; display_name: string; expires_at: string }> =
        {};
      for (const c of cl)
        map[c.item_id] = {
          actor_id: c.actor_id,
          display_name: c.display_name,
          expires_at: c.expires_at,
        };
      setClaims(map);
      setCursor(0);
    } catch (e: any) {
      const msg = e?.message ?? "Eroare la încărcarea ticket-urilor";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setHasLoadedOnce(true);
    }
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [status, priority]);

  // shortcuts: J/K navigare, Enter deschide, R refresh, Esc închide
  useKeyboardShortcuts({
    enabled: selected === null,
    onNext: () => setCursor((c) => Math.min(rows.length - 1, c + 1)),
    onPrev: () => setCursor((c) => Math.max(0, c - 1)),
    onOpen: () => rows[cursor] && setSelected(rows[cursor].id),
    onRefresh: () => load(),
  });

  const forbidden = !!error && /forbidden|denied|insufficient|not allowed|rol|role|policy|permission/i.test(error);
  const fatal = !!error && !hasLoadedOnce; // banner fatal doar dacă nu am nicio versiune anterioară afișabilă

  return (
    <div className="space-y-4">
      <SectionTitle>Ticketing intern</SectionTitle>

      {fatal && (
        <AdminErrorBanner
          variant="fatal"
          error={error}
          forbidden={forbidden}
          title={forbidden ? "Acces refuzat" : "Nu am putut încărca ticket-urile"}
          forbiddenHint={
            <>
              Necesită rol de <code>support</code>, <code>moderator</code>, <code>admin</code> sau{" "}
              <code>super_admin</code>.
            </>
          }
          onRetry={load}
          busy={busy}
        />
      )}

      {!fatal && error && (
        <AdminErrorBanner variant="soft" error={error} onRetry={load} busy={busy} />
      )}

      {slaError && (
        <AdminErrorBanner
          variant="warning"
          error={slaError}
          softLead="Pragurile SLA nu au putut fi încărcate; se folosesc valorile implicite."
        />
      )}


      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Deschise" value={kpi?.open ?? "—"} />
        <Kpi
          label="Urgente"
          value={kpi?.urgent ?? "—"}
          tone={kpi && kpi.urgent > 0 ? "danger" : "default"}
        />
        <Kpi
          label="Neasignate"
          value={kpi?.unassigned ?? "—"}
          tone={kpi && kpi.unassigned > 0 ? "warn" : "default"}
        />
        <Kpi label="Așteaptă user" value={kpi?.waiting ?? "—"} />
      </div>

      <GlassCard>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
          >
            {["open", "pending", "waiting_user", "resolved", "closed", "all"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
          >
            {["all", "low", "normal", "high", "urgent"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Caută în subiect…"
            className="flex-1 min-w-[180px] rounded-md border border-border bg-surface px-2 py-1 text-xs"
          />
          <button
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-primary/50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}{" "}
            Refresh
          </button>
        </div>

        <div className="mb-2">
          <SavedViewsBar<SupportFilters>
            scope="admin.support"
            currentFilters={{ status, priority, search }}
            onApply={(f) => {
              setStatus(f.status);
              setPriority(f.priority);
              setSearch(f.search);
            }}
          />
        </div>

        <ShortcutsHint
          items={[
            { key: "J/K", label: "navighează" },
            { key: "Enter", label: "deschide" },
            { key: "R", label: "refresh" },
            { key: "Esc", label: "închide" },
          ]}
        />

        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-1">
                  <input
                    type="checkbox"
                    aria-label="Selectează tot"
                    checked={bulk.allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = bulk.someChecked;
                    }}
                    onChange={(e) => bulk.selectAllVisible(e.target.checked)}
                  />
                </th>
                <th className="px-2 py-1 text-left">Subject</th>
                <th className="px-2 py-1 text-left">User</th>
                <th className="px-2 py-1">Cat</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Prio</th>
                <th className="px-2 py-1 text-left">SLA / Claim</th>
                <th className="px-2 py-1">Last</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    Fără ticket-uri.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  onClick={() => {
                    setCursor(i);
                    setSelected(r.id);
                  }}
                  className={`cursor-pointer border-t border-border/50 hover:bg-primary/5 ${i === cursor ? "bg-primary/5 outline outline-1 outline-primary/40" : ""} ${bulk.isSelected(r.id) ? "bg-primary/10" : ""}`}
                >
                  <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Selectează ${r.subject}`}
                      checked={bulk.isSelected(r.id)}
                      onChange={() => bulk.toggle(r.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-medium">{r.subject}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.display_name ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-muted-foreground">{r.category}</td>
                  <td className="px-2 py-1.5 text-center">
                    <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</StatusBadge>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <StatusBadge tone={PRIO_TONE[r.priority] ?? "neutral"}>
                      {r.priority}
                    </StatusBadge>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <SlaBadge createdAt={r.created_at} threshold={sla} label="deschis" compact />
                      <ClaimBadge claim={claims[r.id]} meId={meId} />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center text-muted-foreground">
                    {r.last_msg_at ? new Date(r.last_msg_at).toLocaleString("ro-RO") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <BulkActionBar count={bulk.count} onClear={bulk.clear}>
        <select
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">Status…</option>
          {["open", "pending", "waiting_user", "resolved", "closed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={bulkPriority}
          onChange={(e) => setBulkPriority(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">Prioritate…</option>
          {["low", "normal", "high", "urgent"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <ReasonDialog
          trigger={
            <Button
              size="sm"
              disabled={!bulkStatus && !bulkPriority}
              variant={bulkStatus === "closed" ? "destructive" : "default"}
            >
              Aplică pe {bulk.count}
            </Button>
          }
          title={`Aplică pe ${bulk.count} ticket${bulk.count === 1 ? "" : "e"}`}
          description={[
            bulkStatus ? `Status → ${bulkStatus}` : null,
            bulkPriority ? `Prioritate → ${bulkPriority}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          destructive={bulkStatus === "closed"}
          confirmLabel={`Aplică pe ${bulk.count}`}
          onConfirm={async (reason) => {
            const ids = [...bulk.selected];
            // Snapshot before → pentru undo prin journal
            const before = new Map(
              rows
                .filter((r) => bulk.isSelected(r.id))
                .map((r) => [r.id, { status: r.status, priority: r.priority }]),
            );
            const res = await bulkFn({
              data: {
                ticketIds: ids,
                status: (bulkStatus || null) as any,
                priority: (bulkPriority || null) as any,
                reason,
              },
            });
            const { pushAction } = await import("@/components/admin/queue/useActionJournal");
            pushAction({
              label: `Bulk ${bulkStatus || ""}${bulkStatus && bulkPriority ? "+" : ""}${bulkPriority || ""} pe ${res.ok}/${res.total} tickete`,
              undo: async () => {
                // Restaurează per-ticket la starea precedentă
                for (const id of ids) {
                  const prev = before.get(id);
                  if (!prev) continue;
                  await bulkFn({
                    data: {
                      ticketIds: [id],
                      status: prev.status as any,
                      priority: prev.priority as any,
                      reason: "undo bulk action",
                    },
                  });
                }
                await load();
              },
              redo: async () => {
                await bulkFn({
                  data: {
                    ticketIds: ids,
                    status: (bulkStatus || null) as any,
                    priority: (bulkPriority || null) as any,
                    reason: "redo bulk action",
                  },
                });
                await load();
              },
            });
            bulk.clear();
            setBulkStatus("");
            setBulkPriority("");
            await load();
            if (res.failed > 0) throw new Error(`${res.failed}/${res.total} eșuate`);
          }}
        />
      </BulkActionBar>

      {selected && (
        <TicketThread
          ticketId={selected}
          onClose={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TicketThread({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const getThread = useServerFn(getTicketThread);
  const reply = useServerFn(replyToTicket);
  const action = useServerFn(adminTicketAction);
  const [data, setData] = useState<{ ticket: any; messages: Msg[] } | null>(null);
  const [body, setBody] = useState("");
  const [note, setNote] = useState(false);
  const [busy, setBusy] = useState(false);

  // Auto-claim ticketul cât timp thread-ul e deschis
  const claim = useQueueClaim("support", ticketId);

  const load = async () => {
    try {
      setData(await getThread({ data: { ticketId } }));
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    }
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [ticketId]);

  useKeyboardShortcuts({ onClose });

  const send = async () => {
    if (body.trim().length < 1) return;
    setBusy(true);
    try {
      await reply({ data: { ticketId, body: body.trim(), internalNote: note } });
      setBody("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setBusy(false);
    }
  };
  const changeStatus = async (s: string) => {
    const prev = data?.ticket?.status as string | undefined;
    try {
      await action({ data: { ticketId, status: s as any } });
      await load();
      if (prev && prev !== s) {
        pushAction({
          label: `Ticket #${ticketId.slice(0, 8)} · status ${prev} → ${s}`,
          undo: async () => {
            await action({ data: { ticketId, status: prev as any } });
            await load();
          },
          redo: async () => {
            await action({ data: { ticketId, status: s as any } });
            await load();
          },
        });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    }
  };
  const changePrio = async (p: string) => {
    const prev = data?.ticket?.priority as string | undefined;
    try {
      await action({ data: { ticketId, priority: p as any } });
      await load();
      if (prev && prev !== p) {
        pushAction({
          label: `Ticket #${ticketId.slice(0, 8)} · prioritate ${prev} → ${p}`,
          undo: async () => {
            await action({ data: { ticketId, priority: prev as any } });
            await load();
          },
          redo: async () => {
            await action({ data: { ticketId, priority: p as any } });
            await load();
          },
        });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    }
  };

  const claimBanner =
    !claim.loading && !claim.mine && claim.actorId ? (
      <div className="border-b border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-[11px] text-orange-200">
        ⚠️ Acest ticket este deja revendicat de altcineva. Contactează-l înainte să acționezi în
        paralel.
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/60 backdrop-blur-md sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data?.ticket?.subject ?? "Ticket"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              #{ticketId.slice(0, 8)} · {data?.ticket?.category}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-elevated"
          >
            Închide (Esc)
          </button>
        </div>
        {claimBanner}
        <div className="flex flex-wrap gap-2 border-b border-border/50 px-4 py-2 text-[11px]">
          <select
            onChange={(e) => e.target.value && changeStatus(e.target.value)}
            value=""
            className="rounded-md border border-border bg-background px-2 py-1"
          >
            <option value="">Schimbă status…</option>
            {["open", "pending", "waiting_user", "resolved", "closed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            onChange={(e) => e.target.value && changePrio(e.target.value)}
            value=""
            className="rounded-md border border-border bg-background px-2 py-1"
          >
            <option value="">Schimbă prioritatea…</option>
            {["low", "normal", "high", "urgent"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="max-h-[52vh] space-y-2 overflow-y-auto px-4 py-3">
          {data?.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.internal_note
                  ? "border border-yellow-500/40 bg-yellow-500/10"
                  : m.author_role === "staff"
                    ? "bg-primary/10"
                    : "bg-surface-elevated"
              }`}
            >
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.author_role}
                {m.internal_note ? " · notă internă" : ""} ·{" "}
                {new Date(m.created_at).toLocaleString("ro-RO")}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
          {!data && <Loader2 className="mx-auto size-5 animate-spin" />}
        </div>
        <div className="border-t border-border p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Răspuns…"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} />
              Notă internă (staff only)
            </label>
            <button
              onClick={send}
              disabled={busy || body.trim().length === 0}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}{" "}
              Trimite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
