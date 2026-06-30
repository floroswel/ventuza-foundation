import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw, ShieldAlert, Fingerprint, Globe } from "lucide-react";
import { useAdminPanelLoad, PanelStatus, LastCheckBadge } from "@/components/admin/PanelStatus";
import { AutoRefreshSelect, useAdminAutoRefresh } from "@/components/admin/AutoRefreshSelect";
import {
  adminGetSignupThrottleStats,
  type SignupThrottleStats,
} from "@/lib/admin-signup-throttle.functions";

const WINDOW_OPTIONS = [
  { v: 1, l: "1h" },
  { v: 6, l: "6h" },
  { v: 24, l: "24h" },
  { v: 72, l: "3z" },
  { v: 168, l: "7z" },
];

const REASON_LABEL: Record<string, string> = {
  ip_hourly_cap: "IP > 5 / oră",
  ip_daily_cap: "IP > 20 / zi",
  fp_hourly_cap: "Fingerprint > 3 / oră",
  fp_daily_cap: "Fingerprint > 10 / zi",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function short(h: string, n = 12) {
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-4)}` : h;
}

export function SignupThrottlePanel() {
  const get = useServerFn(adminGetSignupThrottleStats);
  const [windowHours, setWindowHours] = useState(24);
  const autoRefreshMs = useAdminAutoRefresh();
  const [state, reload, lastLoadedAt] = useAdminPanelLoad<SignupThrottleStats>(
    () => get({ data: { windowHours } }),
    [windowHours],
    { autoRefreshMs },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Signup throttling</h2>
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
        >
          <RefreshCw className="mr-1 inline size-3" /> Refresh
        </button>
      </div>

      <PanelStatus
        state={state}
        retry={reload}
        isEmpty={state.status === "ready" && state.data.totals.attempts === 0}
        emptyHint="Nicio încercare de signup în fereastra selectată — empty legitim."
      >
        {state.status === "ready" && <Content stats={state.data} />}
      </PanelStatus>
    </div>
  );
}

function Content({ stats }: { stats: SignupThrottleStats }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label={`Încercări ${stats.window_hours}h`} value={stats.totals.attempts} />
        <Kpi label="IP-uri unice" value={stats.totals.unique_ips} />
        <Kpi label="Fingerprints unice" value={stats.totals.unique_fps} />
        <Kpi
          label="IP-uri blocate"
          value={stats.totals.blocked_ips}
          tone={stats.totals.blocked_ips > 0 ? "warning" : undefined}
        />
        <Kpi
          label="FP-uri blocate"
          value={stats.totals.blocked_fps}
          tone={stats.totals.blocked_fps > 0 ? "warning" : undefined}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-3 text-[11px] text-muted-foreground">
        <ShieldAlert className="mr-1 inline size-3" />
        Plafoane active: <b>IP</b> {stats.caps.ip_per_hour}/oră, {stats.caps.ip_per_day}/zi ·{" "}
        <b>Fingerprint</b> {stats.caps.fp_per_hour}/oră, {stats.caps.fp_per_day}/zi.
        IP-urile sunt stocate hash-uite SHA-256 (sărate) — niciun IP în clar.
      </div>

      {stats.totals.blocks_logged > 0 && (
        <Section
          title={`Blocări logate (${stats.totals.blocks_logged})`}
          icon={<ShieldAlert className="size-4 text-red-300" />}
        >
          <div className="mb-2 flex flex-wrap gap-1">
            {(["ip_hourly_cap","ip_daily_cap","fp_hourly_cap","fp_daily_cap"] as const).map((k) => {
              const n = stats.blocks_by_reason[k] ?? 0;
              if (!n) return null;
              return (
                <span
                  key={k}
                  className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300"
                >
                  {REASON_LABEL[k]} · {n}
                </span>
              );
            })}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-xs">
              <thead className="bg-background/40 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <Th>Când</Th>
                  <Th>Motiv</Th>
                  <Th>IP prefix</Th>
                  <Th>FP prefix</Th>
                  <Th align="right">IP/h · IP/zi</Th>
                  <Th align="right">FP/h · FP/zi</Th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_blocks.map((b, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(b.created_at)}</Td>
                    <Td>
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
                        {REASON_LABEL[b.reason] ?? b.reason}
                      </span>
                    </Td>
                    <Td className="font-mono text-[10px]">{b.ip_hash_prefix ?? "—"}</Td>
                    <Td className="font-mono text-[10px]">{b.fp_prefix ?? "—"}</Td>
                    <Td align="right">{b.ip_hour} · {b.ip_day}</Td>
                    <Td align="right">{b.fp_hour} · {b.fp_day}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title={`Top IP-uri (${stats.top_ips.length})`} icon={<Globe className="size-4" />}>
        <Table
          rows={stats.top_ips}
          idKey="ip_hash"
          label="IP hash"
        />
      </Section>

      <Section
        title={`Top fingerprints (${stats.top_fingerprints.length})`}
        icon={<Fingerprint className="size-4" />}
      >
        <Table
          rows={stats.top_fingerprints}
          idKey="fingerprint"
          label="Fingerprint"
        />
      </Section>

      <p className="text-[10px] text-muted-foreground">
        Generat {fmtDate(stats.generated_at)} · fereastră {stats.window_hours}h · sursă{" "}
        <code>public.signup_attempts</code>
      </p>
    </div>
  );
}

type Row = {
  total: number;
  last_hour: number;
  last_day: number;
  last_seen: string;
  blocked_reason: string | null;
  [k: string]: any;
};

function Table({ rows, idKey, label }: { rows: Row[]; idKey: string; label: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-center text-xs text-muted-foreground">
        Nicio intrare în fereastra selectată.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
          <tr>
            <Th>{label}</Th>
            <Th align="right">Total</Th>
            <Th align="right">Ultima oră</Th>
            <Th align="right">Ultima zi</Th>
            <Th>Ultimul</Th>
            <Th>Motiv blocare</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const id = String(r[idKey] ?? "");
            const blocked = !!r.blocked_reason;
            return (
              <tr key={id} className={`border-t border-border ${blocked ? "bg-red-500/5" : ""}`}>
                <Td>
                  <button
                    title={id}
                    onClick={() => navigator.clipboard?.writeText(id)}
                    className="font-mono text-[11px] hover:text-primary"
                  >
                    {short(id)}
                  </button>
                </Td>
                <Td align="right" className="font-semibold">{r.total}</Td>
                <Td align="right" className={r.last_hour > 0 ? "text-orange-300" : ""}>
                  {r.last_hour}
                </Td>
                <Td align="right">{r.last_day}</Td>
                <Td className="text-xs text-muted-foreground">{fmtDate(r.last_seen)}</Td>
                <Td>
                  {blocked ? (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
                      {REASON_LABEL[r.blocked_reason!] ?? r.blocked_reason}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({
  label, value, tone,
}: { label: string; value: number; tone?: "warning" | "danger" }) {
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
  title, icon, children,
}: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
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
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
