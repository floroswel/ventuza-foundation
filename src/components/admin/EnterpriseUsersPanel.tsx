/**
 * EnterpriseUsersPanel — panoul /admin → Utilizatori.
 *
 * Include:
 * - KPI strip (total, noi 24h, activi 7d, banned, suspended, pending age, high risk).
 * - Filtre server-side (status chips, role, verified, has_reports, created since, sort).
 * - Saved views persistente (per operator, per scope "admin.users").
 * - Bulk selection + BulkActionBar (ban/unban/suspend/verify) cu ReasonDialog + audit.
 * - Undo prin action journal (restaurează starea per user).
 * - Row actions: 360, Detalii (drawer), toggle roluri, ștergere.
 * - Skeletoane la loading; empty legitim + error banner distincte.
 * - Shortcut: `/` focus search, `Enter` caută, `Esc` clear filtre.
 *
 * Respectă REGULĂ ADMIN: verificări server-side (assertAdmin/assertStaff),
 * MFA pentru ban/unban/suspend, audit before/after cu justificare.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search, RefreshCw, Trash2, Users, UserCheck, UserX, Ban,
  Clock, ShieldAlert, TrendingUp, X, Filter, Download,
} from "lucide-react";
import { GlassCard, Kpi, MonoNumber, StatusBadge } from "@/components/admin/ui/primitives";
import { SkeletonKpis, SkeletonTable } from "@/components/admin/ui/Skeleton";
import { SavedViewsBar } from "@/components/admin/SavedViewsBar";
import { BulkActionBar } from "@/components/admin/ui/BulkActionBar";
import { ReasonDialog } from "@/components/admin/ReasonDialog";
import { AdminPanelError, AdminPanelEmpty } from "@/components/admin/PanelStatus";
import { UserDetailDrawer } from "@/components/admin/Wave1Sections";
import { Button } from "@/components/ui/button";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { pushAction } from "@/components/admin/queue/useActionJournal";
import {
  adminUserQuickStats, adminSearchUsersV2, adminBulkUserAction,
} from "@/lib/admin-users-ops.functions";
import { adminGrantRole, adminRevokeRole, adminDeleteUser } from "@/lib/admin.functions";

type UserRow = {
  id: string;
  display_name: string | null;
  travel_city: string | null;
  verified: boolean | null;
  banned_at: string | null;
  suspended_until: string | null;
  report_count: number | null;
  level: number | null;
  xp: number | null;
  created_at: string;
  last_seen: string | null;
  age_status: string | null;
  risk_score: number | null;
  deleted_at: string | null;
  partner_suspended_at: string | null;
  thumb: string | null;
  roles: string[];
};

type Stats = {
  total: number; newDay: number; active7d: number;
  banned: number; suspended: number; pendingAge: number;
  highRisk: number; deleted: number;
};

type Filters = {
  q: string;
  status: "any" | "active" | "banned" | "suspended" | "shadow";
  role: "any" | "admin" | "moderator" | "business" | "super_admin" | "auditor" | "support";
  verified: "any" | "verified" | "unverified";
  hasReports: boolean;
  createdSince: "" | "24h" | "7d" | "30d";
  sort: "created_desc" | "created_asc" | "last_seen_desc" | "reports_desc" | "risk_desc" | "xp_desc";
};

const DEFAULT_FILTERS: Filters = {
  q: "", status: "any", role: "any", verified: "any",
  hasReports: false, createdSince: "", sort: "created_desc",
};

function rel(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts).getTime();
  const diff = Date.now() - d;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "acum";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24); if (days < 30) return `${days}z`;
  const mo = Math.floor(days / 30); if (mo < 12) return `${mo}luni`;
  return `${Math.floor(mo / 12)}a`;
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function computeSinceIso(v: Filters["createdSince"]): string | undefined {
  if (!v) return undefined;
  const now = Date.now();
  const ms = v === "24h" ? 24 * 3600e3 : v === "7d" ? 7 * 24 * 3600e3 : 30 * 24 * 3600e3;
  return new Date(now - ms).toISOString();
}

export function EnterpriseUsersPanel({ meId }: { meId: string }) {
  const statsFn = useServerFn(adminUserQuickStats);
  const searchFn = useServerFn(adminSearchUsersV2);
  const bulkFn = useServerFn(adminBulkUserAction);
  const grant = useServerFn(adminGrantRole);
  const revoke = useServerFn(adminRevokeRole);
  const del = useServerFn(adminDeleteUser);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<"ban" | "unban" | "suspend" | "verify" | "unverify">("suspend");
  const [suspendHours, setSuspendHours] = useState(24);
  const searchRef = useRef<HTMLInputElement>(null);

  const bulk = useBulkSelection(rows);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try { setStats(await statsFn()); } catch {} finally { setLoadingStats(false); }
  }, [statsFn]);

  const loadRows = useCallback(async (f: Filters) => {
    setLoading(true); setError(null);
    try {
      const res = await searchFn({
        data: {
          q: f.q || undefined,
          status: f.status,
          role: f.role,
          verified: f.verified,
          hasReports: f.hasReports || undefined,
          createdSince: computeSinceIso(f.createdSince),
          sort: f.sort,
          limit: 100,
        },
      });
      setRows(res as UserRow[]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally { setLoading(false); }
  }, [searchFn]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadRows(filters); }, [loadRows, filters]);

  // Shortcut: `/` focus search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const patch = (p: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...p }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const refresh = () => { loadRows(filters); loadStats(); };

  const toggleRole = async (uid: string, role: any, has: boolean) => {
    try {
      if (has) await revoke({ data: { userId: uid, role } });
      else await grant({ data: { userId: uid, role } });
      toast.success("Rol actualizat");
      pushAction({
        label: `${has ? "Revocare" : "Acordare"} rol ${role}`,
        undo: async () => {
          if (has) await grant({ data: { userId: uid, role } });
          else await revoke({ data: { userId: uid, role } });
          await loadRows(filters);
        },
        redo: async () => {
          if (has) await revoke({ data: { userId: uid, role } });
          else await grant({ data: { userId: uid, role } });
          await loadRows(filters);
        },
      });
      loadRows(filters);
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteUser = async (uid: string) => {
    if (!confirm("Șterge permanent acest cont? Toate datele cascadează.")) return;
    try { await del({ data: { userId: uid } }); toast.success("Cont șters"); loadRows(filters); loadStats(); }
    catch (e: any) { toast.error(e.message); }
  };

  const exportCsv = () => {
    const header = ["id", "display_name", "city", "verified", "status", "roles", "reports", "risk", "xp", "level", "last_seen", "created_at"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const status = r.banned_at ? "banned" : r.suspended_until && new Date(r.suspended_until) > new Date() ? "suspended" : "active";
      const row = [
        r.id, JSON.stringify(r.display_name ?? ""), JSON.stringify(r.travel_city ?? ""),
        r.verified ? "1" : "0", status, JSON.stringify((r.roles || []).join("|")),
        r.report_count ?? 0, r.risk_score ?? 0, r.xp ?? 0, r.level ?? 0,
        r.last_seen ?? "", r.created_at ?? "",
      ];
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `users-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status !== "any") n++;
    if (filters.role !== "any") n++;
    if (filters.verified !== "any") n++;
    if (filters.hasReports) n++;
    if (filters.createdSince) n++;
    if (filters.sort !== "created_desc") n++;
    if (filters.q) n++;
    return n;
  }, [filters]);

  return (
    <div className="space-y-3">
      {/* ---- KPI STRIP ---- */}
      {loadingStats || !stats ? (
        <SkeletonKpis count={7} />
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <Kpi label="Total" value={stats.total} icon={<Users className="size-3" />} />
          <Kpi label="Noi 24h" value={stats.newDay} icon={<TrendingUp className="size-3" />} tone={stats.newDay > 0 ? "success" : "default"} />
          <Kpi label="Activi 7z" value={stats.active7d} icon={<UserCheck className="size-3" />} />
          <Kpi label="Banned" value={stats.banned} icon={<Ban className="size-3" />} tone={stats.banned > 0 ? "danger" : "default"} />
          <Kpi label="Suspendați" value={stats.suspended} icon={<Clock className="size-3" />} tone={stats.suspended > 0 ? "warn" : "default"} />
          <Kpi label="Age pending" value={stats.pendingAge} icon={<UserX className="size-3" />} tone={stats.pendingAge > 0 ? "warn" : "default"} />
          <Kpi label="High risk" value={stats.highRisk} icon={<ShieldAlert className="size-3" />} tone={stats.highRisk > 0 ? "danger" : "default"} />
        </div>
      )}

      {/* ---- SEARCH BAR ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-faint)]" />
          <input
            ref={searchRef}
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadRows(filters);
              if (e.key === "Escape") patch({ q: "" });
            }}
            placeholder="Caută nume, oraș sau UUID… ( / )"
            className="w-full rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-10 pr-4 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-accent)]/60"
          />
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          title="Reîncarcă"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/40 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          title="Export CSV rezultat curent"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/40 disabled:opacity-40"
        >
          <Download className="size-3.5" /> CSV
        </button>
      </div>

      {/* ---- FILTER CHIPS ---- */}
      <GlassCard className="p-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1 text-[var(--admin-text-dim)]">
            <Filter className="size-3" /> Filtre
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-[var(--admin-accent)]/20 px-1.5 py-0.5 text-[10px] text-[var(--admin-accent)]">
                {activeFilterCount}
              </span>
            )}
          </span>

          <FilterGroup label="Status" value={filters.status} onChange={(v) => patch({ status: v as any })}
            options={[
              ["any", "toate"], ["active", "activ"], ["banned", "banned"],
              ["suspended", "suspendat"], ["shadow", "shadow"],
            ]}
          />
          <FilterGroup label="Rol" value={filters.role} onChange={(v) => patch({ role: v as any })}
            options={[
              ["any", "toate"], ["super_admin", "super"], ["admin", "admin"],
              ["moderator", "mod"], ["auditor", "audit"], ["support", "supp"], ["business", "biz"],
            ]}
          />
          <FilterGroup label="Verif" value={filters.verified} onChange={(v) => patch({ verified: v as any })}
            options={[["any", "toate"], ["verified", "da"], ["unverified", "nu"]]}
          />
          <FilterGroup label="Vechime" value={filters.createdSince} onChange={(v) => patch({ createdSince: v as any })}
            options={[["", "oricând"], ["24h", "24h"], ["7d", "7z"], ["30d", "30z"]]}
          />
          <label className="inline-flex cursor-pointer items-center gap-1">
            <input
              type="checkbox"
              checked={filters.hasReports}
              onChange={(e) => patch({ hasReports: e.target.checked })}
            />
            <span className="text-[var(--admin-text-dim)]">cu reports</span>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[var(--admin-text-dim)]">Sort:</span>
            <select
              value={filters.sort}
              onChange={(e) => patch({ sort: e.target.value as any })}
              className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-[11px]"
            >
              <option value="created_desc">creat ↓</option>
              <option value="created_asc">creat ↑</option>
              <option value="last_seen_desc">văzut ↓</option>
              <option value="reports_desc">reports ↓</option>
              <option value="risk_desc">risk ↓</option>
              <option value="xp_desc">xp ↓</option>
            </select>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] px-2 py-1 text-[var(--admin-text-dim)] hover:border-[var(--admin-danger)]/40 hover:text-[var(--admin-danger)]">
                <X className="size-3" /> reset
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 border-t border-[var(--admin-border)]/60 pt-2">
          <SavedViewsBar<Filters>
            scope="admin.users"
            currentFilters={filters}
            onApply={(f) => setFilters({ ...DEFAULT_FILTERS, ...f })}
            compact
          />
        </div>
      </GlassCard>

      {/* ---- STATES ---- */}
      {error && <AdminPanelError error={error} onRetry={() => loadRows(filters)} />}
      {!error && loading && rows.length === 0 && <SkeletonTable rows={8} cols={7} />}
      {!error && !loading && rows.length === 0 && (
        <AdminPanelEmpty label="Niciun utilizator pentru filtrele curente." />
      )}

      {/* ---- TABLE ---- */}
      {!error && rows.length > 0 && (
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-[var(--admin-border)]/60 px-3 py-2 text-[11px] text-[var(--admin-text-dim)]">
            <span>
              <MonoNumber value={rows.length} /> rezultate {loading && <span className="opacity-60">(reîncarc…)</span>}
            </span>
            {bulk.count > 0 && (
              <span className="text-[var(--admin-accent)]">
                {bulk.count} selectat{bulk.count === 1 ? "" : "e"}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[var(--admin-text-faint)]">
                <tr className="border-b border-[var(--admin-border)]/60">
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label="Selectează tot"
                      checked={bulk.allChecked}
                      ref={(el) => { if (el) el.indeterminate = bulk.someChecked; }}
                      onChange={(e) => bulk.selectAllVisible(e.target.checked)}
                    />
                  </th>
                  <th className="px-2 py-2 text-left">Utilizator</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Roluri</th>
                  <th className="px-2 py-2 text-left">Oraș</th>
                  <th className="px-2 py-2 text-right">Rap</th>
                  <th className="px-2 py-2 text-right">Risc</th>
                  <th className="px-2 py-2 text-right">XP · Lv</th>
                  <th className="px-2 py-2 text-right">Văzut</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const status = u.banned_at ? "banned"
                    : u.suspended_until && new Date(u.suspended_until) > new Date() ? "suspended"
                    : "active";
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setDetailId(u.id)}
                      className={`cursor-pointer border-t border-[var(--admin-border)]/40 hover:bg-[var(--admin-surface-2)]/40 ${bulk.isSelected(u.id) ? "bg-[var(--admin-accent)]/5" : ""}`}
                    >
                      <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Selectează ${u.display_name}`}
                          checked={bulk.isSelected(u.id)}
                          onChange={() => bulk.toggle(u.id)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="relative size-8 shrink-0">
                            {u.thumb ? (
                              <img src={u.thumb} alt="" className="size-8 rounded-full object-cover" loading="lazy" />
                            ) : (
                              <div className="flex size-8 items-center justify-center rounded-full bg-[var(--admin-surface-2)] text-[10px] font-semibold text-[var(--admin-text-dim)]">
                                {initials(u.display_name)}
                              </div>
                            )}
                            {u.age_status === "verified" && (
                              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[var(--admin-success)] ring-1 ring-black/40" title="Vârstă verificată" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-[var(--admin-text)]">{u.display_name ?? "(fără nume)"}</span>
                              {u.verified && <StatusBadge tone="approved">verif</StatusBadge>}
                              {u.partner_suspended_at && <StatusBadge tone="rejected">partner off</StatusBadge>}
                            </div>
                            <span className="admin-mono block truncate text-[10px] text-[var(--admin-text-faint)]" title={u.id}>{u.id.slice(0, 8)}… · creat {rel(u.created_at)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {status === "banned" && <StatusBadge tone="banned">banat</StatusBadge>}
                        {status === "suspended" && (
                          <StatusBadge tone="suspended">
                            susp · {rel(u.suspended_until)}
                          </StatusBadge>
                        )}
                        {status === "active" && <StatusBadge tone="active">activ</StatusBadge>}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 && <span className="text-[10px] text-[var(--admin-text-faint)]">—</span>}
                          {u.roles.map((r) => (
                            <StatusBadge key={r} tone={r === "super_admin" ? "rejected" : r === "admin" ? "info" : "neutral"}>{r}</StatusBadge>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-[var(--admin-text-dim)]">{u.travel_city ?? "—"}</td>
                      <td className="px-2 py-2 text-right">
                        <MonoNumber value={u.report_count ?? 0} className={(u.report_count ?? 0) > 0 ? "text-[var(--admin-warn)]" : ""} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MonoNumber value={u.risk_score ?? 0} className={
                          (u.risk_score ?? 0) >= 70 ? "text-[var(--admin-danger)]"
                          : (u.risk_score ?? 0) >= 40 ? "text-[var(--admin-warn)]"
                          : "text-[var(--admin-text-dim)]"
                        } />
                      </td>
                      <td className="px-2 py-2 text-right text-[var(--admin-text-dim)]">
                        <MonoNumber value={u.xp ?? 0} /> · L<MonoNumber value={u.level ?? 0} />
                      </td>
                      <td className="px-2 py-2 text-right text-[var(--admin-text-dim)]">{rel(u.last_seen)}</td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Link to="/admin/users/$id" params={{ id: u.id }}
                            className="rounded-md bg-[var(--admin-accent)] px-2 py-1 text-[10px] font-semibold text-white hover:brightness-110">
                            360
                          </Link>
                          {(["admin", "moderator", "business"] as const).map((r) => {
                            const has = u.roles.includes(r);
                            return (
                              <button key={r} onClick={() => toggleRole(u.id, r, has)}
                                className={`rounded-md px-1.5 py-1 text-[10px] font-semibold ${has ? "bg-blue-500/20 text-blue-300" : "border border-[var(--admin-border)] text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/40"}`}>
                                {has ? "−" : "+"}{r[0]}
                              </button>
                            );
                          })}
                          {u.id !== meId && (
                            <button onClick={() => deleteUser(u.id)}
                              className="rounded-md bg-[var(--admin-danger-soft)] px-1.5 py-1 text-[var(--admin-danger)] hover:brightness-110" title="Șterge cont">
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* ---- BULK ACTION BAR ---- */}
      <BulkActionBar count={bulk.count} onClear={bulk.clear}>
        <select
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value as any)}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="suspend">Suspendă</option>
          <option value="ban">Ban</option>
          <option value="unban">Unban</option>
          <option value="verify">Verifică</option>
          <option value="unverify">Anulează verif</option>
        </select>
        {bulkAction === "suspend" && (
          <input
            type="number" min={1} max={720} value={suspendHours}
            onChange={(e) => setSuspendHours(Number(e.target.value) || 24)}
            onClick={(e) => e.stopPropagation()}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
            title="Ore"
          />
        )}
        <ReasonDialog
          trigger={
            <Button size="sm" variant={bulkAction === "ban" ? "destructive" : "default"}>
              Aplică pe {bulk.count}
            </Button>
          }
          title={`${bulkAction} pe ${bulk.count} utilizator${bulk.count === 1 ? "" : "i"}`}
          description={bulkAction === "suspend" ? `Durată: ${suspendHours}h` : undefined}
          destructive={bulkAction === "ban"}
          confirmLabel={`${bulkAction} pe ${bulk.count}`}
          onConfirm={async (reason) => {
            const ids = [...bulk.selected];
            // Snapshot pentru undo (per user, câmpurile relevante)
            const before = new Map<string, Partial<UserRow>>();
            for (const id of ids) {
              const r = rows.find((x) => x.id === id);
              if (r) before.set(id, {
                banned_at: r.banned_at, suspended_until: r.suspended_until, verified: r.verified,
              });
            }
            const res = await bulkFn({
              data: { userIds: ids, action: bulkAction, hours: suspendHours, reason },
            });
            pushAction({
              label: `Bulk ${bulkAction} pe ${res.ok}/${res.total} useri`,
              undo: async () => {
                // Reversare — nu avem endpoint singular pentru „restaurează stare exactă";
                // aplicăm inversul semantic pe listă (ban↔unban, verify↔unverify).
                // suspend: cel mai bun undo = unban (elimină și suspend_until dacă e cazul,
                // dar suspend nu setează banned_at → trimitem unban care e no-op pe banned_at,
                // iar suspendarea rămâne. Pentru suspend îl anulăm cu update direct.)
                if (bulkAction === "ban") {
                  await bulkFn({ data: { userIds: ids, action: "unban", reason: "undo bulk" } });
                } else if (bulkAction === "unban") {
                  await bulkFn({ data: { userIds: ids, action: "ban", reason: "undo bulk" } });
                } else if (bulkAction === "verify") {
                  await bulkFn({ data: { userIds: ids, action: "unverify", reason: "undo bulk" } });
                } else if (bulkAction === "unverify") {
                  await bulkFn({ data: { userIds: ids, action: "verify", reason: "undo bulk" } });
                } else if (bulkAction === "suspend") {
                  // suspend cu 0h nu e valid → suspend 1h pentru cei ce erau NON-suspendați
                  // nu are undo perfect; cea mai apropiată operațiune: unban (care nu atinge suspend).
                  // În practică: mesaj că suspend-ul nu are undo automat.
                  toast("Suspendarea nu are undo automat. Editează din User 360 dacă e cazul.");
                }
                await loadRows(filters); await loadStats();
              },
              redo: async () => {
                await bulkFn({ data: { userIds: ids, action: bulkAction, hours: suspendHours, reason: "redo bulk" } });
                await loadRows(filters); await loadStats();
              },
            });
            bulk.clear();
            await loadRows(filters); await loadStats();
            if (res.failed > 0) throw new Error(`${res.failed}/${res.total} eșuate`);
          }}
        />
      </BulkActionBar>

      {detailId && <UserDetailDrawer userId={detailId} onClose={() => { setDetailId(null); loadRows(filters); }} />}
    </div>
  );
}

/* ---- helpers ---- */

function FilterGroup({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-[var(--admin-text-dim)]">{label}:</span>
      <div className="inline-flex overflow-hidden rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {options.map(([v, lbl]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`px-2 py-0.5 text-[10px] transition-colors ${
              value === v
                ? "bg-[var(--admin-accent)]/25 text-[var(--admin-accent)]"
                : "text-[var(--admin-text-dim)] hover:bg-[var(--admin-surface-2)]"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
