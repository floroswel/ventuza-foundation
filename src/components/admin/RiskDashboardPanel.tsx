import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, ShieldAlert, TrendingUp, RefreshCw, Activity, Users, Flag, BadgeCheck,
  Search, Filter, X, ChevronLeft, ChevronRight, Fingerprint,
} from "lucide-react";
import { useAdminPanelLoad, PanelStatus, LastCheckBadge } from "@/components/admin/PanelStatus";
import { UserRiskDetailDialog } from "@/components/admin/UserRiskDetailDialog";



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
  const [state, reload, lastLoadedAt] = useAdminPanelLoad<Dashboard>(
    async () => {
      const { data, error } = await (supabase as any).rpc("admin_risk_dashboard", { _window_hours: windowHours });
      if (error) throw new Error(error.message);
      return data as Dashboard;
    },
    [windowHours],
    { autoRefreshMs: 30_000 },
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

  const [openUserId, setOpenUserId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Risk scoring · dashboard</h2>
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
        >
          <RefreshCw className="mr-1 inline size-3" /> Refresh
        </button>
      </div>

      <PanelStatus state={state} retry={reload}>
        {state.status === "ready" && <Content data={state.data} onOpenUser={setOpenUserId} />}
      </PanelStatus>

      <UserRiskDetailDialog userId={openUserId} onClose={() => setOpenUserId(null)} />
    </div>
  );
}

type ScoreBucket = "all" | "0-39" | "40-59" | "60-79" | "80+";
type UserStatus = "all" | "active" | "suspended" | "banned";
type FlagStatus = "all" | "open" | "resolved" | "dismissed";

function inScoreBucket(score: number, b: ScoreBucket): boolean {
  if (b === "all") return true;
  if (b === "0-39") return score < 40;
  if (b === "40-59") return score >= 40 && score < 60;
  if (b === "60-79") return score >= 60 && score < 80;
  return score >= 80;
}

function Content({ data, onOpenUser }: { data: Dashboard; onOpenUser: (id: string) => void }) {
  const s = data.summary;
  const maxDist = useMemo(() => Math.max(...data.distribution.map((b) => b.count), 1), [data.distribution]);
  const maxTrendH = useMemo(() => Math.max(...data.trend_hourly.map((b) => b.flags), 1), [data.trend_hourly]);
  const maxTrendD = useMemo(() => Math.max(...data.trend_daily.map((b) => b.flags), 1), [data.trend_daily]);

  // ===== Filter state =====
  const [search, setSearch] = useState("");
  const [scoreBucket, setScoreBucket] = useState<ScoreBucket>("all");
  const [userStatus, setUserStatus] = useState<UserStatus>("all");
  const [flagStatus, setFlagStatus] = useState<FlagStatus>("all");
  const [flagKind, setFlagKind] = useState<string>("all");
  const [fingerprintQuery, setFingerprintQuery] = useState("");
  const [fingerprintUserIds, setFingerprintUserIds] = useState<Set<string> | null>(null);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [fingerprintError, setFingerprintError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // Resolve fingerprint → user_ids
  useEffect(() => {
    const q = fingerprintQuery.trim();
    if (q.length < 3) {
      setFingerprintUserIds(null);
      setFingerprintError(null);
      return;
    }
    let cancelled = false;
    setFingerprintLoading(true);
    setFingerprintError(null);
    (async () => {
      const { data: rows, error } = await (supabase as any)
        .from("device_fingerprints")
        .select("user_id, fingerprint")
        .ilike("fingerprint", `%${q}%`)
        .limit(500);
      if (cancelled) return;
      if (error) {
        setFingerprintError(error.message);
        setFingerprintUserIds(new Set());
      } else {
        setFingerprintUserIds(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
      }
      setFingerprintLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fingerprintQuery]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, scoreBucket, userStatus, fingerprintUserIds]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.top_users.filter((u) => {
      if (!inScoreBucket(u.risk_score, scoreBucket)) return false;
      if (userStatus === "banned" && !u.banned_at) return false;
      if (userStatus === "suspended" && !(u.suspended_until && !u.banned_at)) return false;
      if (userStatus === "active" && (u.banned_at || u.suspended_until)) return false;
      if (fingerprintUserIds && !fingerprintUserIds.has(u.user_id)) return false;
      if (q) {
        const name = (u.display_name ?? "").toLowerCase();
        const id = u.user_id.toLowerCase();
        if (!name.includes(q) && !id.includes(q)) return false;
      }
      return true;
    });
  }, [data.top_users, search, scoreBucket, userStatus, fingerprintUserIds]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pagedUsers = filteredUsers.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const filteredFlags = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.recent_flags.filter((f) => {
      if (flagStatus !== "all" && f.status !== flagStatus) return false;
      if (flagKind !== "all" && f.kind !== flagKind) return false;
      if (fingerprintUserIds && !fingerprintUserIds.has(f.user_id)) return false;
      if (q) {
        const name = (f.display_name ?? "").toLowerCase();
        if (!name.includes(q) && !f.user_id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data.recent_flags, search, flagStatus, flagKind, fingerprintUserIds]);

  const filtersActive =
    search.trim() !== "" ||
    scoreBucket !== "all" ||
    userStatus !== "all" ||
    flagStatus !== "all" ||
    flagKind !== "all" ||
    fingerprintQuery.trim() !== "";

  const resetFilters = () => {
    setSearch(""); setScoreBucket("all"); setUserStatus("all");
    setFlagStatus("all"); setFlagKind("all"); setFingerprintQuery("");
  };


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

      {/* Filter bar */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Filter className="size-4 text-primary" />
          Filtre & căutare
          {filtersActive && (
            <button
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] hover:bg-primary/10"
            >
              <X className="size-3" /> Reset
            </button>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs">
            <Search className="size-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după nume sau UUID…"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs">
            <Fingerprint className="size-3 text-muted-foreground" />
            <input
              value={fingerprintQuery}
              onChange={(e) => setFingerprintQuery(e.target.value)}
              placeholder="Fingerprint cluster (≥3 caractere)…"
              className="w-full bg-transparent outline-none font-mono"
            />
            {fingerprintLoading && <RefreshCw className="size-3 animate-spin text-muted-foreground" />}
          </label>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <FilterChip label="Scor">
              {(["all", "0-39", "40-59", "60-79", "80+"] as ScoreBucket[]).map((b) => (
                <ChipButton key={b} active={scoreBucket === b} onClick={() => setScoreBucket(b)}>{b === "all" ? "toate" : b}</ChipButton>
              ))}
            </FilterChip>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <FilterChip label="Status user">
              {(["all", "active", "suspended", "banned"] as UserStatus[]).map((b) => (
                <ChipButton key={b} active={userStatus === b} onClick={() => setUserStatus(b)}>
                  {b === "all" ? "toate" : b === "active" ? "activ" : b === "suspended" ? "suspendat" : "banat"}
                </ChipButton>
              ))}
            </FilterChip>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <FilterChip label="Status flag">
              {(["all", "open", "resolved", "dismissed"] as FlagStatus[]).map((b) => (
                <ChipButton key={b} active={flagStatus === b} onClick={() => setFlagStatus(b)}>
                  {b === "all" ? "toate" : b}
                </ChipButton>
              ))}
            </FilterChip>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] lg:col-span-3">
            <FilterChip label="Tip semnal">
              <ChipButton active={flagKind === "all"} onClick={() => setFlagKind("all")}>toate</ChipButton>
              {data.kinds.map((k) => (
                <ChipButton key={k.kind} active={flagKind === k.kind} onClick={() => setFlagKind(k.kind)}>
                  {k.kind} <span className="opacity-60">({k.count})</span>
                </ChipButton>
              ))}
            </FilterChip>
          </div>
        </div>
        {fingerprintError && (
          <div className="mt-2 text-[10px] text-red-300">Eroare fingerprint: {fingerprintError}</div>
        )}
        {fingerprintUserIds && (
          <div className="mt-2 text-[10px] text-muted-foreground">
            Fingerprint match: {fingerprintUserIds.size} useri în cluster
          </div>
        )}
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
      <Section
        title={`Top utilizatori după scor de risc — ${filteredUsers.length}/${data.top_users.length}`}
        icon={<Users className="size-4" />}
      >
        {filteredUsers.length === 0 ? (
          <Empty label={filtersActive ? "Niciun utilizator nu corespunde filtrelor." : "✅ Niciun utilizator peste 0."} />
        ) : (
          <>
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
                  {pagedUsers.map((u) => (
                    <tr
                      key={u.user_id}
                      onClick={() => onOpenUser(u.user_id)}
                      className="cursor-pointer border-t border-border/40 transition-colors hover:bg-primary/10"
                      title="Deschide detaliu risc"
                    >
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
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                Pagina {pageSafe + 1} / {totalPages} ·
                {" "}{pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, filteredUsers.length)} din {filteredUsers.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={pageSafe === 0}
                  className="rounded border border-border px-2 py-0.5 hover:bg-primary/10 disabled:opacity-40"
                >
                  <ChevronLeft className="size-3" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={pageSafe >= totalPages - 1}
                  className="rounded border border-border px-2 py-0.5 hover:bg-primary/10 disabled:opacity-40"
                >
                  <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* Recent flags */}
      <Section
        title={`Semnale recente (live) — ${filteredFlags.length}/${data.recent_flags.length}`}
        icon={<AlertTriangle className="size-4" />}
      >
        {filteredFlags.length === 0 ? (
          <Empty label={filtersActive ? "Niciun semnal nu corespunde filtrelor." : "Niciun semnal în fereastră."} />
        ) : (
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
                {filteredFlags.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => onOpenUser(f.user_id)}
                    className="cursor-pointer border-t border-border/40 transition-colors hover:bg-primary/10"
                    title="Deschide detaliu risc"
                  >
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
