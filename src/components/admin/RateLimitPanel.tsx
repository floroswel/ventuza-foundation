import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Timer,
  Users as UsersIcon,
} from "lucide-react";
import { useAdminPanelLoad, PanelStatus, LastCheckBadge } from "@/components/admin/PanelStatus";
import { adminGetRateLimitStats, type RateLimitStats } from "@/lib/admin-ratelimit.functions";

const WINDOW_OPTIONS = [
  { v: 1, l: "1h" },
  { v: 6, l: "6h" },
  { v: 24, l: "24h" },
  { v: 72, l: "3z" },
  { v: 168, l: "7z" },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RateLimitPanel() {
  const get = useServerFn(adminGetRateLimitStats);
  const [windowHours, setWindowHours] = useState(24);
  const [state, reload, lastLoadedAt] = useAdminPanelLoad<RateLimitStats>(
    () => get({ data: { windowHours } }),
    [windowHours],
    { autoRefreshMs: 30_000 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Rate limit · abuz</h2>
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
        <button
          onClick={reload}
          className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface"
          title="Reîncarcă"
        >
          <RefreshCw className="mr-1 inline size-3" /> Refresh
        </button>
      </div>

      <PanelStatus
        state={state}
        retry={reload}
        isEmpty={state.status === "ready" && state.data.per_action.length === 0}
        emptyHint="Niciun eveniment de rate limit în fereastra selectată — empty legitim."
      >
        {state.status === "ready" && <RateLimitContent stats={state.data} />}
      </PanelStatus>
    </div>
  );
}

function RateLimitContent({ stats }: { stats: RateLimitStats }) {
  const totalHits = useMemo(
    () => stats.per_action.reduce((s, p) => s + p.total, 0),
    [stats.per_action],
  );
  const lastHourHits = useMemo(
    () => stats.per_action.reduce((s, p) => s + p.last_hour_hits, 0),
    [stats.per_action],
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label={`Total ${stats.window_hours}h`} value={totalHits} />
        <Kpi label="Ultima oră" value={lastHourHits} />
        <Kpi
          label="Spikes detectate"
          value={stats.spikes.length}
          tone={stats.spikes.length > 0 ? "warning" : undefined}
        />
        <Kpi
          label="Plafonați acum"
          value={stats.throttled_now.length}
          tone={stats.throttled_now.length > 0 ? "warning" : undefined}
        />
      </div>

      {/* Spike alerts */}
      {stats.spikes.length > 0 && (
        <div className="rounded-2xl border border-orange-500/40 bg-orange-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-300">
            <AlertTriangle className="size-4" />
            Vârfuri de abuz ({stats.spikes.length})
            <span className="ml-auto text-[10px] font-normal opacity-70">
              hits ≥ 50 ȘI ≥ 3× media pe acțiune
            </span>
          </div>
          <ul className="space-y-1">
            {stats.spikes.map((s) => (
              <li
                key={`${s.action}-${s.bucket}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-orange-500/20 px-2 py-0.5 font-mono text-[10px] uppercase">
                    {s.action}
                  </span>
                  <span className="text-orange-200">{fmtDate(s.bucket)}</span>
                </div>
                <div className="flex items-center gap-3 text-orange-100">
                  <span>
                    <b>{s.hits}</b> hits
                  </span>
                  <span className="opacity-70">{s.uniques} useri</span>
                  <span className="opacity-70">avg {s.avg_hits}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-action table */}
      <Section title="Pe acțiune" icon={<Timer className="size-4" />}>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
              <tr>
                <Th>Acțiune</Th>
                <Th align="right">Total</Th>
                <Th align="right">Useri unici</Th>
                <Th align="right">Ultima oră</Th>
                <Th align="right">Useri / oră</Th>
                <Th>Ultimul eveniment</Th>
              </tr>
            </thead>
            <tbody>
              {stats.per_action.map((p) => {
                const hot = p.last_hour_hits > 50;
                return (
                  <tr key={p.action} className="border-t border-border">
                    <Td className="font-mono text-xs">{p.action}</Td>
                    <Td align="right">{p.total}</Td>
                    <Td align="right">{p.unique_users}</Td>
                    <Td align="right" className={hot ? "font-semibold text-orange-300" : ""}>
                      {p.last_hour_hits}
                    </Td>
                    <Td align="right">{p.last_hour_uniques}</Td>
                    <Td className="text-xs text-muted-foreground">{fmtDate(p.last_seen)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Throttled now */}
      <Section
        title={`Plafonați acum (${stats.throttled_now.length})`}
        icon={<ShieldAlert className="size-4" />}
        hint="Useri cu ≥ 10 cereri discover_profiles în ultima oră (= plafon atins)"
      >
        {stats.throttled_now.length === 0 ? (
          <EmptyRow text="Niciun user plafonat în clipa aceasta." />
        ) : (
          <ul className="space-y-1">
            {stats.throttled_now.map((t) => (
              <li
                key={t.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-medium">{t.display_name ?? "(fără nume)"}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{t.user_id}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    <b>{t.hits}</b> hits / oră
                  </span>
                  <span className="text-muted-foreground">ultimul {fmtDate(t.last_hit)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Top offenders */}
      <Section
        title={`Top abuzatori (${stats.top_offenders.length})`}
        icon={<UsersIcon className="size-4" />}
        hint={`Cei mai activi 25 useri în fereastra de ${stats.window_hours}h`}
      >
        {stats.top_offenders.length === 0 ? (
          <EmptyRow text="Niciun ofensator în fereastră." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>User</Th>
                  <Th>Acțiune</Th>
                  <Th align="right">Hits</Th>
                  <Th>Ultimul</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {stats.top_offenders.map((o, i) => (
                  <tr key={`${o.user_id}-${o.action}-${i}`} className="border-t border-border">
                    <Td>
                      <div className="font-medium">{o.display_name ?? "(fără nume)"}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{o.user_id}</div>
                    </Td>
                    <Td className="font-mono text-xs">{o.action}</Td>
                    <Td align="right" className="font-semibold">
                      {o.hits}
                    </Td>
                    <Td className="text-xs text-muted-foreground">{fmtDate(o.last_seen)}</Td>
                    <Td>
                      {o.banned_at ? (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
                          BANNED
                        </span>
                      ) : o.suspended_until && new Date(o.suspended_until) > new Date() ? (
                        <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] text-orange-300">
                          SUSPENDED
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">activ</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <p className="text-[10px] text-muted-foreground">
        Generat {fmtDate(stats.generated_at)} · fereastră {stats.window_hours}h · sursă{" "}
        <code>public.rate_limit_log</code>
      </p>
    </div>
  );
}

/* ---------- mini UI helpers ---------- */
function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "border-red-500/40 bg-red-500/5"
      : tone === "warning"
        ? "border-orange-500/40 bg-orange-500/5"
        : "border-border bg-surface";
  return (
    <div className={`rounded-2xl border p-3 ${toneCls}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} font-medium`}>
      {children}
    </th>
  );
}
function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
