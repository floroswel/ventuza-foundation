import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, ShieldAlert, TrendingUp, RefreshCw, Activity, Users, Flag, BadgeCheck,
} from "lucide-react";
import { useAdminPanelLoad, PanelStatus, LastCheckBadge } from "@/components/admin/PanelStatus";

type Bucket = { bucket: string; count: number };
type Trend = { bucket: string; flags: number; high_risk_users: number };
type TopUser = {
  user_id: string; display_name: string | null; risk_score: number;
  created_at: string; verified: boolean;
  suspended_until: string | null; banned_at: string | null; report_count: number;
};
type Flag = {
  id: string; user_id: string; display_name: string | null;
  kind: string; severity: number; status: string;
  created_at: string; details: Record<string, unknown> | null;
};
type Kind = { kind: string; count: number; avg_severity: number };
type Dashboard = {
  generated_at: string;
  window_hours: number;
  summary: {
    total_profiles: number;
    high_risk_count: number;
    critical_count: number;
    avg_risk: number;
    flags_window: number;
    flags_open: number;
    flags_last_hour: number;
  };
  distribution: Bucket[];
  top_users: TopUser[];
  recent_flags: Flag[];
  kinds: Kind[];
  trend_hourly: Trend[];
  trend_daily: Trend[];
};

const WINDOW_OPTIONS = [
  { v: 24, l: "24h" },
  { v: 72, l: "3z" },
  { v: 168, l: "7z" },
  { v: 720, l: "30z" },
];

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ro-RO", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function scoreTone(score: number): string {
  if (score >= 80) return "bg-red-500/20 text-red-300 border-red-500/40";
  if (score >= 60) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (score >= 40) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
}

export function RiskDashboardPanel() {
  const [windowHours, setWindowHours] = useState(168);
  const [state, reload] = useAdminPanelLoad<Dashboard>(
    async () => {
      const { data, error } = await (supabase as any).rpc("admin_risk_dashboard", { _window_hours: windowHours });
      if (error) throw new Error(error.message);
      return data as Dashboard;
    },
    [windowHours],
  );

  // Live refresh on new risk_flags inserts
  useEffect(() => {
    const ch = supabase
      .channel("risk_dashboard_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "risk_flags" }, () => {
        reload();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: "risk_score=gt.59" }, () => {
        reload();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Risk scoring · dashboard</h2>
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
        <button
          onClick={reload}
          className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface"
        >
          <RefreshCw className="mr-1 inline size-3" /> Refresh
        </button>
      </div>

      <PanelStatus state={state} retry={reload}>
        {state.status === "ready" && <Content data={state.data} />}
      </PanelStatus>
    </div>
  );
}

function Content({ data }: { data: Dashboard }) {
  const s = data.summary;
  const maxDist = useMemo(() => Math.max(...data.distribution.map((b) => b.count), 1), [data.distribution]);
  const maxTrendH = useMemo(() => Math.max(...data.trend_hourly.map((b) => b.flags), 1), [data.trend_hourly]);
  const maxTrendD = useMemo(() => Math.max(...data.trend_daily.map((b) => b.flags), 1), [data.trend_daily]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Useri total" value={s.total_profiles} icon={<Users className="size-3" />} />
        <Kpi label="Risc ≥60" value={s.high_risk_count} icon={<AlertTriangle className="size-3" />}
             tone={s.high_risk_count >= 20 ? "danger" : s.high_risk_count > 0 ? "warn" : "default"} />
        <Kpi label="Risc ≥80" value={s.critical_count} icon={<ShieldAlert className="size-3" />}
             tone={s.critical_count > 0 ? "danger" : "default"} />
        <Kpi label="Scor mediu" value={s.avg_risk} icon={<Activity className="size-3" />} />
        <Kpi label={`Flag-uri (${data.window_hours}h)`} value={s.flags_window} icon={<Flag className="size-3" />} />
        <Kpi label="Flag-uri deschise" value={s.flags_open} icon={<Flag className="size-3" />}
             tone={s.flags_open > 10 ? "warn" : "default"} />
        <Kpi label="Flag-uri ultima oră" value={s.flags_last_hour} icon={<TrendingUp className="size-3" />}
             tone={s.flags_last_hour >= 5 ? "danger" : s.flags_last_hour > 0 ? "warn" : "default"} />
        <Kpi label="Generat" value={fmt(data.generated_at)} icon={<RefreshCw className="size-3" />} />
      </div>

      {/* Distribution */}
      <Section title="Distribuție scor risc" icon={<Activity className="size-4" />}>
        <div className="grid grid-cols-5 gap-2">
          {data.distribution.map((b) => {
            const pct = Math.round((b.count / maxDist) * 100);
            return (
              <div key={b.bucket} className="flex flex-col items-center">
                <div className="flex h-24 w-full items-end overflow-hidden rounded-md border border-border bg-surface">
                  <div
                    className={`w-full ${
                      b.bucket === "80+" ? "bg-red-500/70" :
                      b.bucket === "60-79" ? "bg-amber-500/70" :
                      b.bucket === "40-59" ? "bg-yellow-500/60" :
                      "bg-emerald-500/60"
                    }`}
                    style={{ height: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <div className="mt-1 text-[10px] font-medium">{b.bucket}</div>
                <div className="text-[10px] text-muted-foreground">{b.count}</div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Trends */}
      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Tendință 24h (per oră)" icon={<TrendingUp className="size-4" />}>
          {data.trend_hourly.length === 0 ? <Empty label="Niciun flag în 24h." /> : (
            <div className="flex items-end gap-1 overflow-x-auto py-2">
              {data.trend_hourly.map((b) => {
                const h = Math.max(3, Math.round((b.flags / maxTrendH) * 60));
                return (
                  <div key={b.bucket} className="flex flex-col items-center gap-1"
                       title={`${fmt(b.bucket)} · ${b.flags} flag(s), ${b.high_risk_users} useri risc≥60`}>
                    <div className="w-3 rounded-t bg-primary/60" style={{ height: `${h}px` }} />
                    <div className="text-[9px] text-muted-foreground">{new Date(b.bucket).getHours()}h</div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
        <Section title="Tendință 30z (per zi)" icon={<TrendingUp className="size-4" />}>
          {data.trend_daily.length === 0 ? <Empty label="Niciun flag în 30z." /> : (
            <div className="flex items-end gap-1 overflow-x-auto py-2">
              {data.trend_daily.map((b) => {
                const h = Math.max(3, Math.round((b.flags / maxTrendD) * 60));
                return (
                  <div key={b.bucket} className="flex flex-col items-center gap-1"
                       title={`${b.bucket} · ${b.flags} flag(s), ${b.high_risk_users} useri risc≥60`}>
                    <div className="w-2 rounded-t bg-amber-500/60" style={{ height: `${h}px` }} />
                    <div className="text-[8px] text-muted-foreground">{b.bucket.slice(8)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* Kinds breakdown */}
      <Section title={`Tipuri de semnale (${data.window_hours}h)`} icon={<Flag className="size-4" />}>
        {data.kinds.length === 0 ? <Empty label="Niciun semnal în fereastră." /> : (
          <div className="flex flex-wrap gap-2">
            {data.kinds.map((k) => (
              <div key={k.kind} className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
                <div className="font-semibold uppercase tracking-wide">{k.kind}</div>
                <div className="text-muted-foreground">{k.count} · sev. medie {k.avg_severity}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Top users */}
      <Section title="Top 25 utilizatori după scor de risc" icon={<Users className="size-4" />}>
        {data.top_users.length === 0 ? <Empty label="✅ Niciun utilizator peste 0." /> : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface text-muted-foreground">
                <tr>
                  <th className="text-left p-1">Utilizator</th>
                  <th className="text-right p-1">Scor</th>
                  <th className="text-right p-1">Rap.</th>
                  <th className="text-left p-1">Status</th>
                  <th className="text-left p-1">Creat</th>
                </tr>
              </thead>
              <tbody>
                {data.top_users.map((u) => (
                  <tr key={u.user_id} className="border-t border-border/40">
                    <td className="p-1">
                      <div className="flex items-center gap-1">
                        {u.display_name ?? "(fără nume)"}
                        {u.verified && <BadgeCheck className="size-3 text-primary" />}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground">{u.user_id.slice(0, 12)}…</div>
                    </td>
                    <td className="p-1 text-right">
                      <span className={`rounded border px-2 py-0.5 ${scoreTone(u.risk_score)}`}>{u.risk_score}</span>
                    </td>
                    <td className="p-1 text-right">{u.report_count}</td>
                    <td className="p-1">
                      {u.banned_at ? <span className="text-red-400">banat</span> :
                       u.suspended_until ? <span className="text-amber-300">suspendat</span> :
                       <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-1">{fmt(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Recent flags */}
      <Section title="Semnale recente (live)" icon={<AlertTriangle className="size-4" />}>
        {data.recent_flags.length === 0 ? <Empty label="Niciun semnal în fereastră." /> : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface text-muted-foreground">
                <tr>
                  <th className="text-left p-1">Când</th>
                  <th className="text-left p-1">Tip</th>
                  <th className="text-right p-1">Sev.</th>
                  <th className="text-left p-1">Utilizator</th>
                  <th className="text-left p-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_flags.map((f) => (
                  <tr key={f.id} className="border-t border-border/40">
                    <td className="p-1">{fmt(f.created_at)}</td>
                    <td className="p-1"><span className="rounded bg-primary/10 px-2 py-0.5 uppercase text-[10px]">{f.kind}</span></td>
                    <td className="p-1 text-right">
                      <span className={`rounded border px-2 py-0.5 ${scoreTone(f.severity)}`}>{f.severity}</span>
                    </td>
                    <td className="p-1">
                      <div>{f.display_name ?? "(fără nume)"}</div>
                      <div className="font-mono text-[9px] text-muted-foreground">{f.user_id.slice(0, 12)}…</div>
                    </td>
                    <td className="p-1">
                      {f.status === "open" ? <span className="text-amber-300">open</span> :
                       <span className="text-muted-foreground">{f.status}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="text-[10px] text-muted-foreground">
        Generat: {fmt(data.generated_at)} · update live la flag-uri noi sau scor schimbat
      </div>
    </div>
  );
}

function Kpi({
  label, value, hint, icon, tone = "default",
}: { label: string; value: number | string; hint?: string; icon?: React.ReactNode; tone?: "default" | "warn" | "danger" }) {
  const ring = tone === "danger" ? "border-red-500/40" : tone === "warn" ? "border-amber-500/40" : "border-border";
  return (
    <div className={`rounded-lg border ${ring} bg-surface p-3`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 truncate text-xl font-semibold">{value}</div>
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
