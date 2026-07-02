import { useEffect, useMemo, useRef, useState } from "react";
import { reportSlaFailure } from "@/lib/admin-sla-telemetry";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  Clock,
  Activity,
  Users,
  Ban,
  ShieldCheck,
  MessageSquare,
  Heart,
  Building2,
  Flag,
  LifeBuoy,
  FileWarning,
  Gavel,
  Trash2,
  PowerOff,
  DollarSign,
  MapPin,
  Bot,
  Radio,
  Wifi,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import {
  GlassCard,
  Kpi,
  MonoNumber,
  SectionTitle,
  StatusBadge,
  SeverityBadge,
} from "@/components/admin/ui/primitives";
import { adminGetOverviewRich } from "@/lib/admin-overview.functions";

const AUTO_REFRESH_MS = 60_000;

function fmtMoney(minor: Record<string, number>) {
  const entries = Object.entries(minor);
  if (!entries.length) return "0 RON";
  return entries
    .map(([c, v]) => `${(v / 100).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} ${c}`)
    .join(" · ");
}
function fmtDuration(min: number | null | undefined) {
  if (min == null) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ${min % 60}m`;
  return `${Math.floor(h / 24)}z ${h % 24}h`;
}
function slaTone(min: number | null, sla?: number): "success" | "warn" | "danger" | "neutral" {
  if (min == null) return "neutral";
  const cap = sla ?? 240;
  if (min >= cap) return "danger";
  if (min >= cap * 0.6) return "warn";
  return "success";
}

function Sparkline({
  data,
  color = "var(--admin-accent)",
}: {
  data: { day: string; count: number }[];
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 100,
    h = 32;
  const step = w / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => `${i * step},${h - (d.count / max) * h}`).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full">
      <polygon points={areaPts} fill={color} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      {data.map((d, i) => (
        <circle key={i} cx={i * step} cy={h - (d.count / max) * h} r="1.5" fill={color} />
      ))}
    </svg>
  );
}

function TrendCard({
  title,
  data,
  icon,
}: {
  title: string;
  data: { day: string; count: number }[];
  icon: React.ReactNode;
}) {
  const total = data.reduce((a, b) => a + b.count, 0);
  const today = data[data.length - 1]?.count ?? 0;
  const prev = data[data.length - 2]?.count ?? 0;
  const delta = prev ? Math.round(((today - prev) / prev) * 100) : today > 0 ? 100 : 0;
  return (
    <div className="admin-glass rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[var(--admin-text-faint)]">{icon}</span>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--admin-text-dim)]">
            {title}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] ${delta >= 0 ? "text-[var(--admin-success)]" : "text-[var(--admin-danger)]"}`}
        >
          {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          <span className="admin-mono">{delta > 0 ? `+${delta}%` : `${delta}%`}</span>
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <MonoNumber value={total} className="text-xl font-semibold text-[var(--admin-text)]" />
        <span className="text-[10px] text-[var(--admin-text-faint)]">/ 7 zile · azi {today}</span>
      </div>
      <div className="mt-2">
        <Sparkline data={data} />
      </div>
    </div>
  );
}

export function OverviewPanelRich({ onNavigate }: { onNavigate: (section: string) => void }) {
  const fetchOverview = useServerFn(adminGetOverviewRich);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);

  const hasLoadedOnceRef = useRef(false);
  const load = async () => {
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const d = await fetchOverview();
      setData(d);
      setRefreshedAt(Date.now());
      hasLoadedOnceRef.current = true;
    } catch (e: any) {
      const m = e?.message ?? String(e);
      setError(m);
      if (!/forbidden|role/i.test(m)) toast.error(m);
      await reportSlaFailure(e, {
        rpc: "adminGetOverviewRich",
        callSite: "OverviewPanelRich.load",
        fatal: !hasLoadedOnceRef.current,
        hasLoadedOnce: hasLoadedOnceRef.current,
        durationMs: Math.round(performance.now() - t0),
      });
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [auto]);

  const funnel = useMemo(() => {
    if (!data?.funnel) return null;
    const f = data.funnel;
    const s = f.signup7d || 0;
    const a = f.ageVerified7d || 0;
    const b = f.birthdate7d || 0;
    return [
      { label: "Signup", value: s, pct: 100 },
      { label: "Birthdate completat", value: b, pct: s ? Math.round((b / s) * 100) : 0 },
      { label: "Age verified", value: a, pct: s ? Math.round((a / s) * 100) : 0 },
    ];
  }, [data]);

  if (loading && !data)
    return <Loader2 className="mx-auto mt-12 size-6 animate-spin text-[var(--admin-accent)]" />;
  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <AlertOctagon className="size-4" /> Nu am putut încărca overview-ul
        </div>
        <div className="text-red-200/80">{error}</div>
        <button
          onClick={load}
          className="mt-3 rounded-full border border-red-500/40 px-3 py-1.5 text-xs hover:bg-red-500/10"
        >
          Reîncearcă
        </button>
      </div>
    );
  }
  if (!data) return null;

  const p = data.profiles,
    act = data.activity,
    mod = data.moderation,
    rev = data.revenue;
  const anomalies: any[] = data.anomalies ?? [];
  const queues: any[] = data.queues ?? [];
  const flags = data.flags ?? {};
  const oc = data.onCall ?? {};
  const audit: any[] = data.recentAudit ?? [];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-[var(--admin-text-dim)]">
          <Wifi
            className={`size-3 ${loading ? "animate-pulse text-[var(--admin-accent)]" : "text-[var(--admin-success)]"}`}
          />
          <span>Live</span>
          {refreshedAt && (
            <span className="admin-mono">
              · ultima actualizare {new Date(refreshedAt).toLocaleTimeString("ro-RO")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1 text-[10px] text-[var(--admin-text-dim)]">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="size-3 accent-[var(--admin-accent)]"
            />
            Auto-refresh 60s
          </label>
          <button
            onClick={load}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] px-2.5 py-1 text-[10px] text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/60 hover:text-[var(--admin-text)]"
          >
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> Reîncarcă
          </button>
        </div>
      </div>

      {/* ANOMALIES banner */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          {anomalies.map((a: any, i: number) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                a.severity === "critical"
                  ? "border-[var(--admin-danger)]/40 bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]"
                  : a.severity === "warn"
                    ? "border-[var(--admin-warn)]/40 bg-[var(--admin-warn-soft)] text-[var(--admin-warn)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface-2)] text-[var(--admin-text-dim)]"
              }`}
            >
              <AlertOctagon className="mt-0.5 size-3.5 shrink-0" />
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI band with deltas */}
      <section>
        <SectionTitle>Indicatori cheie</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Kpi label="Useri totali" value={p.total} icon={<Users className="size-3" />} />
          <Kpi
            label="Noi 24h"
            value={p.last24h}
            delta={p.deltaDay}
            icon={<TrendingUp className="size-3" />}
          />
          <Kpi label="Noi 7z" value={p.last7d} delta={p.deltaWeek} />
          <Kpi
            label="Verificați"
            value={p.verified}
            tone="success"
            icon={<ShieldCheck className="size-3" />}
          />
          <Kpi label="Suspendați" value={p.suspended} tone={p.suspended > 0 ? "warn" : "default"} />
          <Kpi
            label="Banați"
            value={p.banned}
            tone={p.banned > 0 ? "danger" : "default"}
            icon={<Ban className="size-3" />}
          />
          <Kpi
            label="Mesaje 24h"
            value={act.messages24h}
            delta={act.messagesDelta}
            icon={<MessageSquare className="size-3" />}
          />
          <Kpi
            label="Match-uri 24h"
            value={act.matches24h}
            delta={act.matchesDelta}
            icon={<Heart className="size-3" />}
          />
        </div>
      </section>

      {/* Trend sparklines */}
      <section>
        <SectionTitle>Trend 7 zile</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          <TrendCard
            title="Signups"
            data={data.trends.signups}
            icon={<Users className="size-3" />}
          />
          <TrendCard
            title="Mesaje"
            data={data.trends.messages}
            icon={<MessageSquare className="size-3" />}
          />
          <TrendCard
            title="Match-uri"
            data={data.trends.matches}
            icon={<Heart className="size-3" />}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* MAIN */}
        <div className="space-y-6">
          {/* Queue depth + SLA */}
          <GlassCard padding="p-4">
            <SectionTitle>Cozi operaționale — SLA</SectionTitle>
            <div className="overflow-hidden rounded-xl border border-[var(--admin-border)]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--admin-surface-2)] text-[10px] uppercase tracking-wider text-[var(--admin-text-dim)]">
                  <tr>
                    <th className="px-3 py-2 text-left">Coadă</th>
                    <th className="px-3 py-2 text-right">Pending</th>
                    <th className="px-3 py-2 text-right">Cel mai vechi</th>
                    <th className="px-3 py-2 text-right">Claim-uri</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {queues.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[11px] text-[var(--admin-text-dim)]">
                        Nicio coadă activă — totul e procesat. (empty legitim)
                      </td>
                    </tr>
                  )}
                  {queues.map((q: any) => {
                    const tone = slaTone(q.oldestMin, q.sla);
                    const claims = oc.claimsByQueue?.[q.key] ?? 0;
                    return (
                      <tr
                        key={q.key}
                        className="border-t border-[var(--admin-border)]/60 hover:bg-white/[0.02]"
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-[var(--admin-text)]">{q.label}</div>
                          {q.urgent > 0 && (
                            <div className="text-[10px] text-[var(--admin-danger)]">
                              {q.urgent} urgente
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right admin-mono">{q.pending}</td>
                        <td className="px-3 py-2 text-right">
                          <StatusBadge
                            tone={
                              tone === "danger"
                                ? "rejected"
                                : tone === "warn"
                                  ? "pending"
                                  : tone === "success"
                                    ? "approved"
                                    : "neutral"
                            }
                          >
                            {fmtDuration(q.oldestMin)}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2 text-right admin-mono text-[var(--admin-text-dim)]">
                          {claims}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => onNavigate(q.route)}
                            className="inline-flex items-center gap-1 text-[10px] text-[var(--admin-accent)] hover:underline"
                          >
                            Deschide <ChevronRight className="size-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Revenue + subs + funnel + top cities */}
          <div className="grid gap-3 sm:grid-cols-2">
            <GlassCard padding="p-4">
              <SectionTitle>Revenue B2B (luna curentă)</SectionTitle>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-[var(--admin-surface-2)] px-3 py-2">
                  <span className="text-xs text-[var(--admin-text-dim)]">
                    <DollarSign className="mr-1 inline size-3" /> Încasat luna
                  </span>
                  <span className="admin-mono text-sm font-semibold text-[var(--admin-success)]">
                    {fmtMoney(rev.revenueMonthMinor)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[var(--admin-surface-2)] px-3 py-2">
                  <span className="text-xs text-[var(--admin-text-dim)]">Outstanding</span>
                  <span className="admin-mono text-sm text-[var(--admin-text)]">
                    {fmtMoney(rev.outstandingMinor)}
                  </span>
                </div>
                {rev.overdueCount > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-[var(--admin-warn-soft)] px-3 py-2">
                    <span className="text-xs text-[var(--admin-warn)]">Overdue</span>
                    <span className="admin-mono text-sm font-semibold text-[var(--admin-warn)]">
                      {rev.overdueCount}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Kpi label="Active" value={rev.subsActive} tone="success" />
                  <Kpi
                    label="Grace"
                    value={rev.subsGrace}
                    tone={rev.subsGrace > 0 ? "warn" : "default"}
                  />
                  <Kpi
                    label="Downgraded"
                    value={rev.subsDowngraded}
                    tone={rev.subsDowngraded > 0 ? "warn" : "default"}
                  />
                </div>
                <button
                  onClick={() => onNavigate("billing")}
                  className="mt-1 w-full rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-xs text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/60 hover:text-[var(--admin-text)]"
                >
                  Deschide B2B billing
                </button>
              </div>
            </GlassCard>

            <GlassCard padding="p-4">
              <SectionTitle>Funnel signup (7z)</SectionTitle>
              {funnel && (
                <div className="space-y-2">
                  {funnel.map((f) => (
                    <div key={f.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--admin-text-dim)]">{f.label}</span>
                        <span className="admin-mono text-[var(--admin-text)]">
                          {f.value} · {f.pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--admin-surface-2)]">
                        <div
                          className="h-full rounded-full bg-[var(--admin-accent)]"
                          style={{ width: `${f.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <SectionTitle>Top orașe (24h)</SectionTitle>
                {data.topCities.length === 0 ? (
                  <p className="text-[10px] text-[var(--admin-text-faint)]">
                    Fără date de oraș în ultimele 24h.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {data.topCities.map((c: any) => (
                      <li key={c.city} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--admin-text)]">
                          <MapPin className="mr-1 inline size-3 text-[var(--admin-text-faint)]" />
                          {c.city}
                        </span>
                        <span className="admin-mono text-[var(--admin-text-dim)]">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Recent critical audit */}
          <GlassCard padding="p-4">
            <SectionTitle
              action={
                <button
                  onClick={() => onNavigate("audit")}
                  className="text-[10px] text-[var(--admin-accent)] hover:underline"
                >
                  Vezi tot
                </button>
              }
            >
              Evenimente critice recente
            </SectionTitle>
            {audit.length === 0 ? (
              <p className="text-xs text-[var(--admin-text-faint)]">
                Fără evenimente critice recente. Bun.
              </p>
            ) : (
              <ul className="space-y-1">
                {audit.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)]/60 bg-[var(--admin-surface-2)] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <SeverityBadge value={r.severity} />
                      <span className="font-medium text-[var(--admin-text)]">{r.action}</span>
                      {r.targetTable && (
                        <span className="text-[10px] text-[var(--admin-text-faint)]">
                          · {r.targetTable}
                        </span>
                      )}
                    </div>
                    <span className="admin-mono text-[10px] text-[var(--admin-text-faint)]">
                      {new Date(r.createdAt).toLocaleString("ro-RO")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>

        {/* RIGHT — Trust theatre */}
        <aside className="space-y-3">
          {/* On call */}
          <GlassCard padding="p-4" elevated>
            <SectionTitle>Echipa în tură</SectionTitle>
            <div className="flex items-baseline gap-2">
              <MonoNumber
                value={oc.operatorsOnline ?? 0}
                className="text-3xl font-semibold text-[var(--admin-text)]"
              />
              <span className="text-[10px] text-[var(--admin-text-dim)]">
                operatori online · {oc.totalActiveClaims ?? 0} claim-uri active
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(oc.claimsByQueue ?? {}).map(([q, n]) => (
                <span
                  key={q}
                  className="rounded-full bg-[var(--admin-surface-2)] px-2 py-0.5 text-[10px] text-[var(--admin-text-dim)]"
                >
                  {q} · <span className="admin-mono text-[var(--admin-text)]">{String(n)}</span>
                </span>
              ))}
              {Object.keys(oc.claimsByQueue ?? {}).length === 0 && (
                <span className="text-[10px] text-[var(--admin-text-faint)]">
                  Nimeni nu ține un item acum.
                </span>
              )}
            </div>
          </GlassCard>

          {/* Kill switches state */}
          <GlassCard padding="p-4">
            <SectionTitle
              action={
                <button
                  onClick={() => onNavigate("killswitches")}
                  className="text-[10px] text-[var(--admin-accent)] hover:underline"
                >
                  Gestionează
                </button>
              }
            >
              Kill switches
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Flag-uri total" value={flags.total ?? 0} />
              <Kpi
                label="Off"
                value={flags.disabled ?? 0}
                tone={flags.disabled > 0 ? "warn" : "default"}
              />
            </div>
            {flags.killedCritical?.length > 0 && (
              <div className="mt-2 space-y-1">
                {flags.killedCritical.map((f: any) => (
                  <div
                    key={f.key}
                    className="flex items-center justify-between rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger-soft)] px-3 py-1.5 text-xs"
                  >
                    <span className="flex items-center gap-1 text-[var(--admin-danger)]">
                      <PowerOff className="size-3" /> {f.key}
                    </span>
                    <span className="admin-mono text-[10px] text-[var(--admin-danger)]">OFF</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Moderation snapshot */}
          <GlassCard padding="p-4">
            <SectionTitle>Moderare & risc</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Ads active" value={mod.adsActive} />
              <Kpi
                label="Ads pending"
                value={mod.adsPending}
                tone={mod.adsPending > 0 ? "warn" : "default"}
              />
              <Kpi
                label="B2B pending"
                value={mod.bizPending}
                tone={mod.bizPending > 0 ? "warn" : "default"}
              />
              <Kpi label="Abonamente" value={mod.subsActive} tone="success" />
              <Kpi
                label="SAR GDPR"
                value={mod.gdprSar}
                tone={mod.gdprSar > 0 ? "warn" : "default"}
              />
              <Kpi
                label="Risc >70 (7z)"
                value={mod.riskHigh7d}
                tone={mod.riskHigh7d > 0 ? "warn" : "default"}
              />
              <Kpi
                label="Parteneri susp."
                value={mod.partnerSuspended}
                tone={mod.partnerSuspended > 0 ? "warn" : "default"}
              />
              <Kpi
                label="SOS 24h"
                value={act.sos24h}
                tone={act.sos24h > 0 ? "danger" : "default"}
              />
            </div>
          </GlassCard>

          {/* Quick jumps */}
          <GlassCard padding="p-3">
            <SectionTitle>Salt rapid</SectionTitle>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ["users", "Users", Users],
                ["reports", "Reports", Flag],
                ["support", "Support", LifeBuoy],
                ["csam", "CSAM", FileWarning],
                ["breach", "Breșe", AlertOctagon],
                ["appeals", "Apeluri", Gavel],
                ["gdpr", "GDPR ops", Trash2],
                ["partners", "Parteneri", Building2],
                ["billing", "Billing", DollarSign],
                ["killswitches", "Kill sw.", PowerOff],
                ["settings", "Settings", Sparkles],
                ["audit", "Audit log", Activity],
              ].map(([id, label, Icon]: any) => (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-2 py-1.5 text-[10px] text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/60 hover:text-[var(--admin-text)]"
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              ))}
            </div>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}
