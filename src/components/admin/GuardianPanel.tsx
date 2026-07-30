/**
 * GUARDIAN DASHBOARD — starea aplicației, incidente, acțiuni automate și
 * acțiuni care așteaptă aprobare umană.
 *
 * Pattern obligatoriu (AGENTS.md → ADMIN PANELS): loading / error / empty
 * legitim, distincte.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Users as UsersIcon,
  FileText,
} from "lucide-react";
import { useAdminPanelLoad, PanelStatus, LastCheckBadge } from "@/components/admin/PanelStatus";
import {
  guardianGetDashboard,
  guardianDecideAction,
  guardianSetIncidentStatus,
  guardianGetReport,
  type GuardianDashboard,
} from "@/lib/guardian.functions";

const WINDOWS = [
  { v: 1, l: "1h" },
  { v: 24, l: "24h" },
  { v: 72, l: "3z" },
  { v: 168, l: "7z" },
];

const SEV_STYLE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-orange-500/15 text-orange-500",
  medium: "bg-amber-500/15 text-amber-600",
  low: "bg-muted text-muted-foreground",
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GuardianPanel() {
  const getDash = useServerFn(guardianGetDashboard);
  const decide = useServerFn(guardianDecideAction);
  const setStatus = useServerFn(guardianSetIncidentStatus);
  const getReport = useServerFn(guardianGetReport);

  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  const [state, reload, lastLoadedAt] = useAdminPanelLoad<GuardianDashboard>(
    () => getDash({ data: { hours } }),
    [hours],
    { autoRefreshMs: 60_000 },
  );

  const d = state.data;
  const pending = useMemo(() => (d?.actions ?? []).filter((a) => a.status === "pending"), [d]);
  const executed = useMemo(() => (d?.actions ?? []).filter((a) => a.status !== "pending"), [d]);

  async function onDecide(actionId: string, decision: "approve" | "reject" | "rollback") {
    const reason = window.prompt(
      "Motivul deciziei (minim 10 caractere — se salvează în audit log):",
    );
    if (!reason || reason.trim().length < 10) {
      toast.error("Motiv prea scurt. Minim 10 caractere.");
      return;
    }
    setBusy(actionId);
    try {
      await decide({ data: { actionId, decision, reason: reason.trim() } });
      toast.success("Decizie înregistrată.");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onIncident(incidentId: string, status: "resolved" | "mitigated" | "ignored") {
    setBusy(incidentId);
    try {
      await setStatus({ data: { incidentId, status } });
      toast.success("Status actualizat.");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onReport(period: "daily" | "weekly") {
    try {
      setReport(await getReport({ data: { period } }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-4 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">Guardian · sănătatea aplicației</h2>
        <LastCheckBadge at={lastLoadedAt} />
        <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-surface p-1">
          {WINDOWS.map((o) => (
            <button
              key={o.v}
              onClick={() => setHours(o.v)}
              className={`rounded-full px-3 py-1 text-xs ${
                hours === o.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <PanelStatus state={state} onRetry={reload} emptyLabel="Niciun eveniment înregistrat (empty legitim)." />

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={Activity} label="Evenimente" value={d.totals?.events ?? 0} />
            <Stat
              icon={AlertTriangle}
              label="Critice"
              value={d.totals?.critical ?? 0}
              tone={(d.totals?.critical ?? 0) > 0 ? "bad" : "ok"}
            />
            <Stat icon={UsersIcon} label="Utilizatori afectați" value={d.totals?.users_affected ?? 0} />
            <Stat
              icon={CheckCircle2}
              label="Incidente deschise"
              value={d.open_incidents ?? 0}
              tone={(d.open_incidents ?? 0) > 0 ? "warn" : "ok"}
            />
          </div>

          {/* Acțiuni care așteaptă aprobare */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4" aria-hidden /> Așteaptă aprobare ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nicio acțiune în așteptare (empty legitim).
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.map((a) => (
                  <li key={a.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${SEV_STYLE[a.risk] ?? SEV_STYLE.low}`}>
                        risc {a.risk}
                      </span>
                      <span className="font-medium">{a.action_type}</span>
                      <span className="text-xs text-muted-foreground">{a.decision}</span>
                      {!a.reversible && (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                          ireversibil
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{a.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["approve", "reject", "rollback"] as const).map((dec) => (
                        <button
                          key={dec}
                          disabled={busy === a.id}
                          onClick={() => onDecide(a.id, dec)}
                          className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          {dec === "approve" ? "Approve" : dec === "reject" ? "Reject" : "Rollback"}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Incidente */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Incidente ({d.incidents?.length ?? 0})</h3>
            {(d.incidents?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun incident (empty legitim).</p>
            ) : (
              <ul className="space-y-2">
                {d.incidents.map((i) => (
                  <li key={i.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${SEV_STYLE[i.severity]}`}>
                        {i.severity}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{i.category}</span>
                      <span className="text-sm font-medium">{i.title}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {i.event_count}× · {i.users_affected} useri · {fmt(i.last_seen)}
                      </span>
                    </div>
                    {i.probable_cause && (
                      <p className="mt-1 text-xs text-muted-foreground">Cauză: {i.probable_cause}</p>
                    )}
                    {i.proposed_fix && (
                      <p className="text-xs text-muted-foreground">Soluție: {i.proposed_fix}</p>
                    )}
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Status: {i.status} · fingerprint: {i.fingerprint}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["resolved", "mitigated", "ignored"] as const).map((s) => (
                        <button
                          key={s}
                          disabled={busy === i.id}
                          onClick={() => onIncident(i.id, s)}
                          className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Acțiuni executate */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">
              Acțiuni automate / decise ({executed.length})
            </h3>
            {executed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nicio acțiune (empty legitim).</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {executed.map((a) => (
                  <li key={a.id} className="flex flex-wrap gap-2 border-b border-border/50 py-1">
                    <span className="font-medium">{a.action_type}</span>
                    <span className="text-xs text-muted-foreground">{a.status}</span>
                    <span className="text-xs text-muted-foreground">{a.summary}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{fmt(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Rapoarte */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4" aria-hidden /> Rapoarte
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => onReport("daily")}
                className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                Raport zilnic
              </button>
              <button
                onClick={() => onReport("weekly")}
                className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                Raport săptămânal
              </button>
            </div>
            {report && (
              <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-muted p-3 text-xs">
                {JSON.stringify(report, null, 2)}
              </pre>
            )}
          </section>

          {/* Evenimente recente */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Evenimente recente</h3>
            {(d.recent_events?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun eveniment (empty legitim).</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {d.recent_events.map((e) => (
                  <li key={e.id} className="flex flex-wrap gap-2 border-b border-border/50 py-1">
                    <span className={`rounded px-1.5 ${SEV_STYLE[e.severity] ?? ""}`}>{e.severity}</span>
                    <span className="text-muted-foreground">{e.category}</span>
                    <span className="min-w-0 flex-1 truncate">{e.message}</span>
                    <span className="text-muted-foreground">{e.route}</span>
                    <span className="text-muted-foreground">
                      {e.platform} · {e.app_version}
                    </span>
                    <span className="text-muted-foreground">{fmt(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "ok",
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}
