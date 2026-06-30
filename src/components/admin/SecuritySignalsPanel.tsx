import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, ShieldAlert, RefreshCw, Users, Fingerprint, TrendingUp, Clock,
} from "lucide-react";
import { useAdminPanelLoad, PanelStatus, LastCheckBadge } from "@/components/admin/PanelStatus";
import { AutoRefreshSelect, useAdminAutoRefresh } from "@/components/admin/AutoRefreshSelect";
import {
  adminGetSecuritySignals, type SecuritySignals,
} from "@/lib/admin-security-signals.functions";

const WINDOW_OPTIONS = [
  { v: 1, l: "1h" },
  { v: 6, l: "6h" },
  { v: 24, l: "24h" },
  { v: 72, l: "3z" },
  { v: 168, l: "7z" },
];

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function SecuritySignalsPanel() {
  const get = useServerFn(adminGetSecuritySignals);
  const [windowHours, setWindowHours] = useState(24);
  const autoRefreshMs = useAdminAutoRefresh();
  const [state, reload, lastLoadedAt] = useAdminPanelLoad<SecuritySignals>(
    () => get({ data: { windowHours } }),
    [windowHours],
    { autoRefreshMs },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Semnale de securitate · anti-abuz</h2>
        <LastCheckBadge at={lastLoadedAt} />
        <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-surface p-1">
          {WINDOW_OPTIONS.map((o) => (
            <button
              key={o.v}
              onClick={() => setWindowHours(o.v)}
              className={`rounded-full px-3 py-1 text-xs ${
                windowHours === o.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        <AutoRefreshSelect />
        <button
          onClick={reload}
          className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface"
          title="Click pentru refresh manual"
        >
          <RefreshCw className="mr-1 inline size-3" /> Refresh
        </button>
      </div>

      <PanelStatus
        state={state}
        retry={reload}
        isEmpty={false}
      >
        {state.status === "ready" && <Content data={state.data} />}
      </PanelStatus>
    </div>
  );
}

function Content({ data }: { data: SecuritySignals }) {
  const s = data.summary;
  const spikePct = useMemo(() => {
    if (!s.signups_prev_hour) return s.signups_last_hour > 0 ? 100 : 0;
    return Math.round(((s.signups_last_hour - s.signups_prev_hour) / s.signups_prev_hour) * 100);
  }, [s]);

  return (
    <div className="space-y-4">
      {/* Active alerts */}
      {data.alerts.length > 0 ? (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                a.severity === "high"
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : a.severity === "medium"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-border bg-surface"
              }`}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium uppercase tracking-wide text-[10px] opacity-70">{a.kind}</div>
                <div>{a.message}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-200">
          ✅ Nicio alertă activă. Sistemul este stabil în fereastra selectată.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Signup ultima oră" value={s.signups_last_hour} hint={`vs ${s.signups_prev_hour} h-1 (${spikePct > 0 ? "+" : ""}${spikePct}%)`} icon={<TrendingUp className="size-3" />} tone={spikePct > 200 ? "danger" : "default"} />
        <Kpi label={`Signup ${data.window_hours}h`} value={s.signups_total} hint={`medie ${s.signups_avg_per_hour}/h`} icon={<Users className="size-3" />} />
        <Kpi label="Useri risc ≥60" value={s.high_risk_count} icon={<ShieldAlert className="size-3" />} tone={s.high_risk_count >= 10 ? "danger" : s.high_risk_count > 0 ? "warn" : "default"} />
        <Kpi label="Fingerprints duplicate" value={s.duplicate_fingerprint_count} icon={<Fingerprint className="size-3" />} tone={s.duplicate_fingerprint_count >= 3 ? "warn" : "default"} />
      </div>

      {/* Hourly chart (text) */}
      <Section title="Signup-uri pe oră" icon={<Clock className="size-4" />}>
        {data.signups_hourly.length === 0 ? (
          <Empty label="Niciun signup în fereastră." />
        ) : (
          <div className="flex items-end gap-1 overflow-x-auto py-2">
            {data.signups_hourly.map((b) => {
              const max = Math.max(...data.signups_hourly.map((x) => x.count), 1);
              const h = Math.max(4, Math.round((b.count / max) * 60));
              return (
                <div key={b.bucket} className="flex flex-col items-center gap-1" title={`${fmt(b.bucket)}: ${b.count}`}>
                  <div className="w-4 rounded-t bg-primary/60" style={{ height: `${h}px` }} />
                  <div className="text-[9px] text-muted-foreground">{new Date(b.bucket).getHours()}h</div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* High risk users */}
      <Section title="Useri cu risc ridicat (≥60)" icon={<ShieldAlert className="size-4" />}>
        {data.high_risk_users.length === 0 ? (
          <Empty label="Niciun user peste prag." />
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left p-1">User</th><th className="text-right p-1">Risk</th><th className="text-left p-1">Creat</th><th className="text-left p-1">Status</th></tr>
            </thead>
            <tbody>
              {data.high_risk_users.map((u) => (
                <tr key={u.user_id} className="border-t border-border/40">
                  <td className="p-1"><div>{u.display_name ?? "(fără nume)"}</div><div className="font-mono text-[9px] text-muted-foreground">{u.user_id.slice(0,8)}…</div></td>
                  <td className="p-1 text-right"><span className={`rounded px-2 py-0.5 ${u.risk_score >= 80 ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}>{u.risk_score}</span></td>
                  <td className="p-1">{fmt(u.created_at)}</td>
                  <td className="p-1">{u.banned_at ? <span className="text-red-400">banat</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Duplicate fingerprints */}
      <Section title="Fingerprints folosite de mai multe conturi" icon={<Fingerprint className="size-4" />}>
        {data.duplicate_fingerprints.length === 0 ? (
          <Empty label="Niciun fingerprint duplicat." />
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left p-1">Fingerprint</th><th className="text-right p-1">Conturi</th><th className="text-left p-1">Ultima utilizare</th></tr>
            </thead>
            <tbody>
              {data.duplicate_fingerprints.map((f) => (
                <tr key={f.fingerprint} className="border-t border-border/40">
                  <td className="p-1 font-mono">{f.fingerprint}</td>
                  <td className="p-1 text-right"><span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">{f.user_count}</span></td>
                  <td className="p-1">{fmt(f.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Recent accounts */}
      <Section title={`Conturi noi (${data.window_hours}h)`} icon={<Users className="size-4" />}>
        {data.recent_accounts.length === 0 ? (
          <Empty label="Niciun cont nou." />
        ) : (
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface text-muted-foreground">
                <tr><th className="text-left p-1">User</th><th className="text-right p-1">Risk</th><th className="text-left p-1">Vârstă</th><th className="text-left p-1">Creat</th></tr>
              </thead>
              <tbody>
                {data.recent_accounts.map((u) => (
                  <tr key={u.user_id} className="border-t border-border/40">
                    <td className="p-1">{u.display_name ?? "(fără nume)"} <span className="font-mono text-[9px] text-muted-foreground">{u.user_id.slice(0,8)}</span></td>
                    <td className="p-1 text-right">{u.risk_score ?? 0}</td>
                    <td className="p-1">{u.age_status ?? "—"}</td>
                    <td className="p-1">{fmt(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="text-[10px] text-muted-foreground">Generat: {fmt(data.generated_at)}</div>
    </div>
  );
}

function Kpi({ label, value, hint, icon, tone = "default" }: { label: string; value: number; hint?: string; icon?: React.ReactNode; tone?: "default" | "warn" | "danger" }) {
  const ring = tone === "danger" ? "border-red-500/40" : tone === "warn" ? "border-amber-500/40" : "border-border";
  return (
    <div className={`rounded-lg border ${ring} bg-surface p-3`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-3 text-center text-xs text-muted-foreground">{label}</div>;
}
