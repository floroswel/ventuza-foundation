import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send } from "lucide-react";
import {
  adminListTickets, adminTicketStats, getTicketThread, replyToTicket, adminTicketAction,
} from "@/lib/admin-support.functions";
import { getSlaThresholds, listQueueClaims } from "@/lib/admin-queue.functions";
import { GlassCard, Kpi, SectionTitle, StatusBadge } from "@/components/admin/ui/primitives";
import { SlaBadge, type SlaThreshold } from "@/components/admin/queue/SlaBadge";
import { ClaimBadge } from "@/components/admin/queue/ClaimBadge";
import { useQueueClaim } from "@/components/admin/queue/useQueueClaim";
import { useKeyboardShortcuts, ShortcutsHint } from "@/components/admin/queue/useKeyboardShortcuts";
import { supabase } from "@/integrations/supabase/client";

type TicketRow = {
  id: string; user_id: string; subject: string; category: string;
  status: string; priority: string; assignee_id: string | null;
  last_msg_at: string | null; created_at: string; display_name?: string;
};
type Msg = {
  id: string; author_id: string; author_role: string;
  body: string; internal_note: boolean; created_at: string;
};

const STATUS_TONE: Record<string, "pending" | "approved" | "rejected" | "neutral"> = {
  open: "pending", pending: "pending", waiting_user: "neutral",
  resolved: "approved", closed: "neutral",
};
const PRIO_TONE: Record<string, "pending" | "rejected" | "neutral" | "approved"> = {
  low: "neutral", normal: "neutral", high: "pending", urgent: "rejected",
};

export function SupportTicketsPanel() {
  const list = useServerFn(adminListTickets);
  const stats = useServerFn(adminTicketStats);
  const slaFn = useServerFn(getSlaThresholds);
  const claimsFn = useServerFn(listQueueClaims);

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [kpi, setKpi] = useState<{ open: number; urgent: number; unassigned: number; waiting: number } | null>(null);
  const [status, setStatus] = useState<"open" | "pending" | "waiting_user" | "resolved" | "closed" | "all">("open");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent" | "all">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [sla, setSla] = useState<SlaThreshold | undefined>();
  const [claims, setClaims] = useState<Record<string, { actor_id: string; display_name: string; expires_at: string }>>({});
  const [meId, setMeId] = useState<string | undefined>();

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id)); }, []);
  useEffect(() => { slaFn().then((all) => setSla(all?.support)).catch(() => {}); }, [slaFn]);

  const load = async () => {
    setBusy(true);
    try {
      const [r, k, cl] = await Promise.all([
        list({ data: { status, priority, search: search || undefined, limit: 100 } }),
        stats(),
        claimsFn({ data: { queue: "support" } }),
      ]);
      setRows(r.rows as TicketRow[]);
      setKpi(k);
      const map: Record<string, { actor_id: string; display_name: string; expires_at: string }> = {};
      for (const c of cl) map[c.item_id] = { actor_id: c.actor_id, display_name: c.display_name, expires_at: c.expires_at };
      setClaims(map);
      setCursor(0);
    } catch (e: any) { toast.error(e?.message ?? "Eroare"); } finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, priority]);

  // shortcuts: J/K navigare, Enter deschide, R refresh, Esc închide
  useKeyboardShortcuts({
    enabled: selected === null,
    onNext:    () => setCursor((c) => Math.min(rows.length - 1, c + 1)),
    onPrev:    () => setCursor((c) => Math.max(0, c - 1)),
    onOpen:    () => rows[cursor] && setSelected(rows[cursor].id),
    onRefresh: () => load(),
  });

  return (
    <div className="space-y-4">
      <SectionTitle>Ticketing intern</SectionTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Deschise" value={kpi?.open ?? "—"} />
        <Kpi label="Urgente" value={kpi?.urgent ?? "—"} tone={kpi && kpi.urgent > 0 ? "danger" : "default"} />
        <Kpi label="Neasignate" value={kpi?.unassigned ?? "—"} tone={kpi && kpi.unassigned > 0 ? "warn" : "default"} />
        <Kpi label="Așteaptă user" value={kpi?.waiting ?? "—"} />
      </div>

      <GlassCard>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
            {["open", "pending", "waiting_user", "resolved", "closed", "all"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as any)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
            {["all", "low", "normal", "high", "urgent"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Caută în subiect…"
            className="flex-1 min-w-[180px] rounded-md border border-border bg-surface px-2 py-1 text-xs" />
          <button onClick={load} disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-primary/50">
            {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} Refresh
          </button>
        </div>

        <ShortcutsHint items={[
          { key: "J/K", label: "navighează" },
          { key: "Enter", label: "deschide" },
          { key: "R", label: "refresh" },
          { key: "Esc", label: "închide" },
        ]} />

        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
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
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Fără ticket-uri.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id} onClick={() => { setCursor(i); setSelected(r.id); }}
                  className={`cursor-pointer border-t border-border/50 hover:bg-primary/5 ${i === cursor ? "bg-primary/5 outline outline-1 outline-primary/40" : ""}`}>
                  <td className="px-2 py-1.5 font-medium">{r.subject}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.display_name ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-muted-foreground">{r.category}</td>
                  <td className="px-2 py-1.5 text-center">
                    <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</StatusBadge>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <StatusBadge tone={PRIO_TONE[r.priority] ?? "neutral"}>{r.priority}</StatusBadge>
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

      {selected && <TicketThread ticketId={selected} onClose={() => { setSelected(null); load(); }} />}
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
    try { setData(await getThread({ data: { ticketId } })); }
    catch (e: any) { toast.error(e?.message ?? "Eroare"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ticketId]);

  useKeyboardShortcuts({ onClose });

  const send = async () => {
    if (body.trim().length < 1) return;
    setBusy(true);
    try {
      await reply({ data: { ticketId, body: body.trim(), internalNote: note } });
      setBody(""); await load();
    } catch (e: any) { toast.error(e?.message ?? "Eroare"); } finally { setBusy(false); }
  };
  const changeStatus = async (s: string) => {
    try { await action({ data: { ticketId, status: s as any } }); await load(); }
    catch (e: any) { toast.error(e?.message ?? "Eroare"); }
  };
  const changePrio = async (p: string) => {
    try { await action({ data: { ticketId, priority: p as any } }); await load(); }
    catch (e: any) { toast.error(e?.message ?? "Eroare"); }
  };

  const claimBanner = !claim.loading && !claim.mine && claim.actorId ? (
    <div className="border-b border-orange-500/40 bg-orange-500/10 px-4 py-1.5 text-[11px] text-orange-200">
      ⚠️ Acest ticket este deja revendicat de altcineva. Contactează-l înainte să acționezi în paralel.
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/60 backdrop-blur-md sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data?.ticket?.subject ?? "Ticket"}</p>
            <p className="truncate text-[11px] text-muted-foreground">#{ticketId.slice(0, 8)} · {data?.ticket?.category}</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-elevated">Închide (Esc)</button>
        </div>
        {claimBanner}
        <div className="flex flex-wrap gap-2 border-b border-border/50 px-4 py-2 text-[11px]">
          <select onChange={(e) => e.target.value && changeStatus(e.target.value)} value=""
            className="rounded-md border border-border bg-background px-2 py-1">
            <option value="">Schimbă status…</option>
            {["open", "pending", "waiting_user", "resolved", "closed"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select onChange={(e) => e.target.value && changePrio(e.target.value)} value=""
            className="rounded-md border border-border bg-background px-2 py-1">
            <option value="">Schimbă prioritatea…</option>
            {["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="max-h-[52vh] space-y-2 overflow-y-auto px-4 py-3">
          {data?.messages.map((m) => (
            <div key={m.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.internal_note ? "border border-yellow-500/40 bg-yellow-500/10"
                : m.author_role === "staff" ? "bg-primary/10" : "bg-surface-elevated"
              }`}>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.author_role}{m.internal_note ? " · notă internă" : ""} · {new Date(m.created_at).toLocaleString("ro-RO")}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
          {!data && <Loader2 className="mx-auto size-5 animate-spin" />}
        </div>
        <div className="border-t border-border p-3">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            placeholder="Răspuns…"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} />
              Notă internă (staff only)
            </label>
            <button onClick={send} disabled={busy || body.trim().length === 0}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />} Trimite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
