import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Loader2, ShieldAlert, Ban, Check, X, AlertTriangle, ShieldCheck, BadgeCheck,
  Megaphone, Play, Pause, Building2, LayoutDashboard, Users, Database, Send,
  Trash2, Save, Search, RefreshCw, ChevronLeft, ChevronRight, Crown,
  ScrollText, Bell, FileWarning, FileText, KeyRound, Download, AlertOctagon, Sparkles,
  Activity, Bot,
} from "lucide-react";
import { AdminShell, type NavItem } from "@/components/admin/AdminShell";
import { GlassCard, Kpi, MonoNumber, StatusBadge, SectionTitle } from "@/components/admin/ui/primitives";
import { DataTable, type Column } from "@/components/admin/ui/DataTable";
import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";
import { AiCopilotPanel } from "@/components/admin/AiCopilotPanel";
import {
  adminGetOverview, adminListTables, adminListRows, adminUpdateRow, adminDeleteRow,
  adminInsertRow, adminSearchUsers, adminGrantRole, adminRevokeRole, adminBroadcast,
  adminDeleteUser, ADMIN_TABLES,
} from "@/lib/admin.functions";
import {
  AuditLogPanel, AlertsPanel, DsaPanel, CsamPanel, BreachPanel,
  PoliciesPanel, SecurityPanel,
} from "@/components/admin/EnterpriseSections";
import {
  UserDetailDrawer, GdprOpsPanel, BreakGlassLogPanel,
} from "@/components/admin/Wave1Sections";
import { PartnersModerationPanel } from "@/components/admin/PartnersModerationPanel";
import { BillingAdminPanel } from "@/components/admin/BillingAdminPanel";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { FeedbackInbox } from "@/components/admin/FeedbackInbox";
import { ExperimentsPanel } from "@/components/admin/ExperimentsPanel";
import { isProductionHost, shouldEnforceAgeGate, clearAgeGatePolicyCache } from "@/lib/age-gate-policy";
import { DemoSeedPanel, DemoSeedBanner } from "@/components/admin/DemoSeedPanel";
import { RateLimitPanel } from "@/components/admin/RateLimitPanel";


function AgeGateDevBanner() {
  const [enforce, setEnforce] = useState<boolean | null>(null);
  useEffect(() => {
    clearAgeGatePolicyCache();
    shouldEnforceAgeGate().then(setEnforce);
  }, []);
  if (enforce === null || enforce === true) return null;
  return (
    <div className="border-b border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-center text-xs text-yellow-300">
      ⚠️ <b>AGE VERIFICATION DEZACTIVAT</b> (feature_flags.age_verification = OFF) —
      DOAR în non-producție ({typeof window !== "undefined" ? window.location.hostname : "?"}).
      În build de producție se forțează ON automat indiferent de flag.
      Reactivează din <b>Securitate → Feature flags</b> → toggle <code>age_verification</code>.
      <span className="ml-1 opacity-70">isProductionHost: {String(isProductionHost())}</span>
    </div>
  );
}


export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: AdminDashboard,
});

type Section =
  | "overview" | "users" | "reports" | "risk" | "ads" | "biz"
  | "data" | "broadcast" | "audit" | "alerts" | "dsa" | "csam"
  | "gdpr" | "breakglass" | "breach" | "policies" | "security"
  | "partners" | "demoseed" | "health" | "copilot" | "billing" | "ratelimit";

type Report = {
  id: string; reporter_id: string; reported_id: string; reason: string;
  details: string | null; status: string; created_at: string;
  reported_profile?: { display_name: string | null; report_count: number; suspended_until: string | null } | null;
};
type RiskRow = {
  user_id: string; display_name: string | null; risk_score: number;
  risk_signals: Record<string, unknown>; verified: boolean; report_count: number;
  suspended_until: string | null; banned_at: string | null; open_flags: number;
  duplicate_photo_accounts: number; recent_flag_kinds: string[]; last_flag_at: string | null;
};

function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isMod, setIsMod] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [section, setSection] = useState<Section>("overview");

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) {
        toast.error("Nu am putut verifica rolul: " + error.message);
        setIsAdmin(false);
        setIsMod(false);
        return;
      }
      const admin = roles?.some((r) => r.role === "admin" || r.role === "super_admin") ?? false;
      const mod = roles?.some((r) => r.role === "admin" || r.role === "moderator" || r.role === "super_admin") ?? false;
      const sup = roles?.some((r) => r.role === "super_admin") ?? false;
      setIsAdmin(admin);
      setIsMod(mod);
      setIsSuper(sup);
      if (!admin && !mod) toast.error("Acces interzis: rol admin necesar");
    })();
  }, [user, loading, navigate]);

  // Auto-logout după 15 min de inactivitate — hooks MEREU înainte de early returns
  const onIdle = useCallback(async () => {
    if (!isAdmin && !isMod) return;
    toast.warning("Sesiune admin expirată după 15 min inactivitate");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }, [isAdmin, isMod, navigate]);
  useIdleLogout(15, onIdle, isAdmin === true || isMod);

  if (loading || isAdmin === null) {
    return <div className="flex min-h-dvh items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (!isAdmin && !isMod) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <ShieldAlert className="mx-auto size-12 text-destructive" />
          <h1 className="mt-3 text-lg font-semibold">Acces interzis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ai nevoie de rol admin pentru această pagină.</p>
          <button onClick={() => navigate({ to: "/" })} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Înapoi acasă</button>
        </div>
      </div>
    );
  }


  const allItems: (NavItem & { id: Section; adminOnly?: boolean })[] = [
    // Operations
    { id: "overview", label: "Overview", icon: LayoutDashboard, group: "Operations", adminOnly: true, hint: "KPI, activitate, growth" },
    { id: "alerts",   label: "Alerte",   icon: Bell,            group: "Operations", hint: "Notificări staff" },
    { id: "copilot",  label: "Copilot AI", icon: Bot,           group: "Operations", hint: "Asistent procedural" },
    { id: "broadcast",label: "Broadcast",icon: Send,            group: "Operations", adminOnly: true },

    // Trust & Safety
    { id: "users",    label: "Utilizatori", icon: Users,        group: "Trust & Safety", adminOnly: true },
    { id: "reports",  label: "Rapoarte",  icon: ShieldAlert,    group: "Trust & Safety" },
    { id: "risk",     label: "Risc",      icon: AlertTriangle,  group: "Trust & Safety" },
    { id: "csam",     label: "CSAM",      icon: ShieldAlert,    group: "Trust & Safety", adminOnly: true },
    { id: "dsa",      label: "DSA",       icon: FileWarning,    group: "Trust & Safety" },

    // Compliance
    { id: "gdpr",       label: "GDPR Ops",    icon: Download,    group: "Compliance", adminOnly: true },
    { id: "breakglass", label: "Break-glass", icon: ShieldAlert, group: "Compliance", adminOnly: true },
    { id: "breach",     label: "Breșe",       icon: AlertOctagon,group: "Compliance", adminOnly: true },
    { id: "policies",   label: "Politici",    icon: FileText,    group: "Compliance" },
    { id: "audit",      label: "Audit",       icon: ScrollText,  group: "Compliance" },

    // Business
    { id: "ads",      label: "Ads",            icon: Megaphone,   group: "Business" },
    { id: "biz",      label: "B2B",            icon: Building2,   group: "Business" },
    { id: "partners", label: "Parteneri & Moderare", icon: ShieldCheck, group: "Business" },
    { id: "billing",  label: "Facturare parteneri", icon: FileText,    group: "Business" },

    // System
    { id: "health",   label: "System Health", icon: Activity,    group: "System" },
    { id: "security", label: "Securitate",    icon: KeyRound,    group: "System" },
    { id: "ratelimit",label: "Rate limit",    icon: Activity,    group: "System" },
    { id: "data",     label: "Date (toate)",  icon: Database,    group: "System", adminOnly: true },
    { id: "demoseed", label: "Demo seed",     icon: Sparkles,    group: "System", adminOnly: true },
  ];
  const items: NavItem[] = allItems
    .filter((i) => !i.adminOnly || isAdmin)
    .map(({ adminOnly: _a, ...rest }) => rest);

  const roleLabel = isSuper ? "SUPER ADMIN" : isAdmin ? "ADMIN" : "MOD";

  return (
    <AdminShell
      items={items}
      active={section}
      onSelect={(id) => setSection(id as Section)}
      roleLabel={roleLabel}
      banner={<><AgeGateDevBanner /><DemoSeedBanner /></>}
    >
      {section === "overview" && isAdmin && <OverviewPanel />}
      {section === "alerts" && <AlertsPanel />}
      {section === "copilot" && <AiCopilotPanel />}
      {section === "users" && isAdmin && <UsersPanel meId={user!.id} />}
      {section === "reports" && <ReportsPanel meId={user!.id} />}
      {section === "risk" && <RiskPanel />}
      {section === "csam" && isAdmin && <CsamPanel />}
      {section === "dsa" && <DsaPanel />}
      {section === "gdpr" && isAdmin && <GdprOpsPanel />}
      {section === "breakglass" && isAdmin && <BreakGlassLogPanel />}
      {section === "breach" && isAdmin && <BreachPanel />}
      {section === "policies" && <PoliciesPanel />}
      {section === "audit" && <AuditLogPanel />}
      {section === "ads" && <AdsPanel />}
      {section === "biz" && <BizPanel />}
      {section === "data" && isAdmin && <DataExplorerPanel />}
      {section === "broadcast" && isAdmin && <BroadcastPanel />}
      {section === "partners" && <PartnersModerationPanel canAdmin={!!isAdmin} />}
      {section === "billing" && <BillingAdminPanel isAdmin={!!isAdmin} />}
      {section === "security" && <SecurityPanel />}
      {section === "demoseed" && isAdmin && <DemoSeedPanel isSuperAdmin={isSuper} />}
      {section === "health" && <SystemHealthPanel />}
      {section === "ratelimit" && <RateLimitPanel />}
    </AdminShell>
  );
}

/* ---------------- Shared panel state UI ---------------- */
function AdminPanelError({ error, onRetry, hint }: { error: string; onRetry?: () => void; hint?: string }) {
  const forbidden = /forbidden|denied|insufficient|not allowed|rol|role|policy|permission/i.test(error);
  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
      <p className="font-semibold text-red-300">{forbidden ? "Acces refuzat" : "Eroare la încărcare"}</p>
      <p className="mt-1 break-words text-xs text-red-200/90">{error}</p>
      {forbidden && (
        <p className="mt-2 text-[11px] text-red-200/70">
          Acest panou cere un rol pe care contul tău nu îl are (ex: <code>super_admin</code> / <code>auditor</code>).
        </p>
      )}
      {hint && <p className="mt-1 text-[11px] text-red-200/70">{hint}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10">Reîncearcă</button>
      )}
    </div>
  );
}
function AdminPanelEmpty({ label }: { label: string }) {
  return <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">{label}</div>;
}

/* ---------------- OVERVIEW ---------------- */
function OverviewPanel() {
  const getOverview = useServerFn(adminGetOverview);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await getOverview()); }
    catch (e: any) { const m = e?.message ?? String(e); setError(m); toast.error(m); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Loader2 className="mx-auto mt-12 size-6 animate-spin text-[var(--admin-accent)]" />;
  if (error) return <AdminPanelError error={error} onRetry={load} />;
  if (!data) return <AdminPanelEmpty label="Fără date." />;

  const m = data.moderation ?? {};
  const a = data.activity ?? {};
  const p = data.profiles ?? {};
  const attention = [
    { label: "Rapoarte pending", count: m.reportsPending ?? 0, tone: "warn" as const },
    { label: "Ads pending", count: m.adsPending ?? 0, tone: "warn" as const },
    { label: "B2B pending", count: m.bizPending ?? 0, tone: "warn" as const },
    { label: "SOS 7 zile", count: a.sos7d ?? 0, tone: (a.sos7d ?? 0) > 0 ? "danger" : "neutral" as const },
  ];

  return (
    <div className="space-y-6">
      {/* KPI band — 8 compact tiles */}
      <section>
        <SectionTitle action={
          <button onClick={load} className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] px-2.5 py-1 text-[10px] text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/60 hover:text-[var(--admin-text)]">
            <RefreshCw className="size-3" /> Reîncarcă
          </button>
        }>Indicatori cheie</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Kpi label="Useri totali" value={p.total} />
          <Kpi label="Noi 24h" value={p.last24h} delta={p.last24h ?? null} />
          <Kpi label="Noi 7 zile" value={p.last7d} />
          <Kpi label="Verificați" value={p.verified} tone="success" />
          <Kpi label="Suspendați" value={p.suspended} tone={p.suspended > 0 ? "warn" : "default"} />
          <Kpi label="Banați" value={p.banned} tone={p.banned > 0 ? "danger" : "default"} />
          <Kpi label="Mesaje 24h" value={a.messages24h} />
          <Kpi label="Match-uri 24h" value={a.matches24h} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column — analytics + activity */}
        <div className="space-y-6">
          <GlassCard padding="p-4">
            <SectionTitle>Analytics</SectionTitle>
            <AnalyticsPanel />
          </GlassCard>

          <div className="grid gap-3 sm:grid-cols-2">
            <GlassCard padding="p-3">
              <SectionTitle>Moderare & Business</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Ads active" value={m.adsActive} />
                <Kpi label="Ads pending" value={m.adsPending} tone={m.adsPending > 0 ? "warn" : "default"} />
                <Kpi label="B2B pending" value={m.bizPending} tone={m.bizPending > 0 ? "warn" : "default"} />
                <Kpi label="Abonamente" value={m.subsActive} tone="success" />
              </div>
            </GlassCard>
            <GlassCard padding="p-3">
              <SectionTitle>Activitate</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Evenimente" value={a.events} />
                <Kpi label="Eveniment noi 24h" value={a.events24h} />
                <Kpi label="SOS 7 zile" value={a.sos7d} tone={a.sos7d > 0 ? "danger" : "default"} hint={a.sos7d > 0 ? "verifică urgent" : undefined} />
                <Kpi label="Rapoarte pending" value={m.reportsPending} tone={m.reportsPending > 0 ? "warn" : "default"} />
              </div>
            </GlassCard>
          </div>

          <GlassCard padding="p-4">
            <SectionTitle>Inbox & experimente</SectionTitle>
            <div className="space-y-4">
              <FeedbackInbox />
              <ExperimentsPanel />
            </div>
          </GlassCard>
        </div>

        {/* Right column — needs attention */}
        <aside className="space-y-3">
          <GlassCard padding="p-4" elevated>
            <SectionTitle>Necesită atenție</SectionTitle>
            <ul className="space-y-2">
              {attention.map((a) => (
                <li key={a.label} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)]/60 bg-[var(--admin-surface-2)] px-3 py-2">
                  <span className="text-xs text-[var(--admin-text-dim)]">{a.label}</span>
                  <StatusBadge tone={a.tone === "danger" ? "rejected" : a.tone === "warn" ? "pending" : "neutral"}>
                    <MonoNumber value={a.count} />
                  </StatusBadge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-[var(--admin-text-faint)]">
              Treci la tab-urile dedicate din sidebar pentru acțiuni.
            </p>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- USERS ---------------- */
function UsersPanel({ meId }: { meId: string }) {
  const search = useServerFn(adminSearchUsers);
  const grant = useServerFn(adminGrantRole);
  const revoke = useServerFn(adminRevokeRole);
  const del = useServerFn(adminDeleteUser);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async (query = "") => {
    setBusy(true); setError(null);
    try { setRows(await search({ data: { q: query || undefined, limit: 100 } })); }
    catch (e: any) { const m = e?.message ?? String(e); setError(m); toast.error(m); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleRole = async (uid: string, role: any, has: boolean) => {
    try {
      if (has) await revoke({ data: { userId: uid, role } });
      else await grant({ data: { userId: uid, role } });
      toast.success("Rol actualizat");
      load(q);
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteUser = async (uid: string) => {
    if (!confirm("Șterge permanent acest cont? Toate datele cascadează.")) return;
    try { await del({ data: { userId: uid } }); toast.success("Cont șters"); load(q); }
    catch (e: any) { toast.error(e.message); }
  };

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Utilizator",
      cell: (u) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-[var(--admin-text)]">{u.display_name ?? "(fără nume)"}</span>
            {u.verified && <StatusBadge tone="approved">verif</StatusBadge>}
          </div>
          <span className="admin-mono block truncate text-[10px] text-[var(--admin-text-faint)]">{u.id}</span>
        </div>
      ),
      sortValue: (u) => u.display_name ?? "",
      searchValue: (u) => `${u.display_name ?? ""} ${u.id} ${u.city ?? ""}`,
    },
    {
      key: "status",
      header: "Status",
      priority: 2,
      cell: (u) =>
        u.banned_at ? <StatusBadge tone="banned">banat</StatusBadge>
        : u.suspended_until && new Date(u.suspended_until) > new Date() ? <StatusBadge tone="suspended">suspendat</StatusBadge>
        : <StatusBadge tone="active">activ</StatusBadge>,
      sortValue: (u) => (u.banned_at ? "z" : u.suspended_until ? "s" : "a"),
    },
    {
      key: "roles",
      header: "Roluri",
      priority: 2,
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.length === 0 && <span className="text-[10px] text-[var(--admin-text-faint)]">—</span>}
          {u.roles.map((r: string) => (
            <StatusBadge key={r} tone="info">{r}</StatusBadge>
          ))}
        </div>
      ),
      sortValue: (u) => u.roles.join(","),
    },
    { key: "city", header: "Oraș", priority: 3, cell: (u) => <span className="text-xs text-[var(--admin-text-dim)]">{u.city ?? "—"}</span>, sortValue: (u) => u.city ?? "" },
    { key: "lvl", header: "Lv", align: "right", priority: 3, cell: (u) => <MonoNumber value={u.level} />, sortValue: (u) => u.level ?? 0 },
    { key: "xp", header: "XP", align: "right", priority: 3, cell: (u) => <MonoNumber value={u.xp} />, sortValue: (u) => u.xp ?? 0 },
    {
      key: "rep",
      header: "Rap",
      align: "right",
      priority: 2,
      cell: (u) => <MonoNumber value={u.report_count ?? 0} className={u.report_count > 0 ? "text-[var(--admin-warn)]" : ""} />,
      sortValue: (u) => u.report_count ?? 0,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (u) => (
        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setDetailId(u.id)} className="rounded-md bg-[var(--admin-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--admin-accent)] hover:brightness-110">
            Detalii
          </button>
          {(["admin", "moderator", "business"] as const).map((r) => {
            const has = u.roles.includes(r);
            return (
              <button key={r} onClick={() => toggleRole(u.id, r, has)} className={`rounded-md px-1.5 py-1 text-[10px] font-semibold ${has ? "bg-blue-500/20 text-blue-300" : "border border-[var(--admin-border)] text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/40"}`}>
                {has ? "−" : "+"}{r[0]}
              </button>
            );
          })}
          {u.id !== meId && (
            <button onClick={() => deleteUser(u.id)} className="rounded-md bg-[var(--admin-danger-soft)] px-1.5 py-1 text-[var(--admin-danger)] hover:brightness-110">
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)}
            placeholder="Caută server-side după nume, oraș sau UUID..."
            className="w-full rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-10 pr-4 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-accent)]/60" />
        </div>
        <button onClick={() => load(q)} disabled={busy} className="rounded-full bg-[var(--admin-accent)] px-4 py-2 text-xs font-semibold text-[oklch(0.16_0.02_60)] shadow-[var(--admin-accent-glow)] disabled:opacity-50">
          Caută
        </button>
      </div>

      {error && <AdminPanelError error={error} onRetry={() => load(q)} />}
      {busy && rows.length === 0 && !error && <AdminPanelEmpty label="Se încarcă…" />}

      {!error && (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(u) => u.id}
          searchPlaceholder="Filtrare locală…"
          exportName="utilizatori"
          emptyLabel="Niciun rezultat."
          onRowClick={(u) => setDetailId(u.id)}
        />
      )}
      {detailId && <UserDetailDrawer userId={detailId} onClose={() => { setDetailId(null); load(q); }} />}
    </div>
  );
}

/* ---------------- DATA EXPLORER ---------------- */
function DataExplorerPanel() {
  const listTables = useServerFn(adminListTables);
  const listRows = useServerFn(adminListRows);
  const updateRow = useServerFn(adminUpdateRow);
  const deleteRow = useServerFn(adminDeleteRow);
  const insertRow = useServerFn(adminInsertRow);

  const [tables, setTables] = useState<{ name: string; count: number }[]>([]);
  const [table, setTable] = useState<string>("profiles");
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchCol, setSearchCol] = useState("");
  const [editing, setEditing] = useState<{ id: any; json: string } | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const limit = 25;

  useEffect(() => {
    (async () => {
      try { setTables(await listTables()); } catch (e: any) { toast.error(e.message); }
    })();
  }, []);

  const load = async () => {
    setBusy(true);
    try {
      const res = await listRows({
        data: {
          table: table as any,
          limit, offset: page * limit,
          search: search || undefined,
          searchColumn: search ? (searchCol || undefined) : undefined,
        },
      });
      setRows(res.rows); setCount(res.count);
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
  useEffect(() => { load(); }, [table, page]);

  const columns = useMemo(() => {
    if (rows[0]) return Object.keys(rows[0]);
    return [];
  }, [rows]);

  const save = async () => {
    if (!editing) return;
    try {
      const patch = JSON.parse(editing.json);
      // Don't try to update id itself
      delete patch.id;
      await updateRow({ data: { table: table as any, id: editing.id, patch } });
      toast.success("Salvat");
      setEditing(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const del = async (id: any) => {
    if (!confirm(`Șterge rândul ${String(id).slice(0, 8)}?`)) return;
    try { await deleteRow({ data: { table: table as any, id } }); toast.success("Șters"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const create = async () => {
    if (!creating) return;
    try {
      const values = JSON.parse(creating);
      await insertRow({ data: { table: table as any, values } });
      toast.success("Creat");
      setCreating(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={table} onChange={(e) => { setTable(e.target.value); setPage(0); setSearch(""); }}
          className="rounded-full border border-border bg-surface px-3 py-2 text-xs">
          {tables.length === 0 && ADMIN_TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
          {tables.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.count})</option>)}
        </select>
        <input value={searchCol} onChange={(e) => setSearchCol(e.target.value)} placeholder="coloană (ex: display_name)"
          className="rounded-full border border-border bg-surface px-3 py-2 text-xs w-44" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(0), load())}
          placeholder="caută (ilike)" className="flex-1 min-w-[180px] rounded-full border border-border bg-surface px-3 py-2 text-xs" />
        <button onClick={() => { setPage(0); load(); }} disabled={busy} className="rounded-full bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">
          Caută
        </button>
        <button onClick={() => setCreating("{\n  \n}")} className="rounded-full border border-border px-3 py-2 text-xs hover:bg-surface">
          + Insert
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        {count} rânduri · pagina {page + 1} / {Math.max(1, Math.ceil(count / limit))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-xs">
          <thead className="bg-background/50">
            <tr>
              {columns.slice(0, 6).map((c) => <th key={c} className="px-2 py-2 text-left font-medium">{c}</th>)}
              <th className="px-2 py-2 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id ?? JSON.stringify(r).slice(0, 50)} className="border-t border-border">
                {columns.slice(0, 6).map((c) => (
                  <td key={c} className="max-w-[200px] truncate px-2 py-2">{formatCell(r[c])}</td>
                ))}
                <td className="px-2 py-2 text-right">
                  <button onClick={() => setEditing({ id: r.id, json: JSON.stringify(r, null, 2) })}
                    className="mr-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">edit</button>
                  {r.id && (
                    <button onClick={() => del(r.id)} className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] text-red-500">
                      <Trash2 className="inline size-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">Niciun rând.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button disabled={page === 0 || busy} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-30">
          <ChevronLeft className="inline size-3" /> Înapoi
        </button>
        <button disabled={(page + 1) * limit >= count || busy} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-30">
          Înainte <ChevronRight className="inline size-3" />
        </button>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={`Editare rând ${String(editing.id).slice(0, 8)}`}>
          <textarea value={editing.json} onChange={(e) => setEditing({ ...editing, json: e.target.value })}
            className="h-[60vh] w-full rounded-xl border border-border bg-background p-3 font-mono text-xs" />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="rounded-full border border-border px-4 py-2 text-xs">Anulează</button>
            <button onClick={save} className="rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground">
              <Save className="mr-1 inline size-3" /> Salvează
            </button>
          </div>
        </Modal>
      )}

      {creating !== null && (
        <Modal onClose={() => setCreating(null)} title={`Insert în ${table}`}>
          <textarea value={creating} onChange={(e) => setCreating(e.target.value)}
            placeholder='{ "column": "value" }'
            className="h-[40vh] w-full rounded-xl border border-border bg-background p-3 font-mono text-xs" />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setCreating(null)} className="rounded-full border border-border px-4 py-2 text-xs">Anulează</button>
            <button onClick={create} className="rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground">Creează</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- BROADCAST ---------------- */
function BroadcastPanel() {
  const send = useServerFn(adminBroadcast);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"all" | "verified" | "business">("all");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Titlu și mesaj obligatorii");
    if (!confirm(`Trimit notificare către audiența "${audience}"?`)) return;
    setBusy(true);
    try {
      const r = await send({ data: { title, body, link: link || undefined, audience } });
      toast.success(`Trimis către ${r.delivered} utilizatori`);
      setTitle(""); setBody(""); setLink("");
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h2 className="text-lg font-semibold">Broadcast notificare</h2>
      <select value={audience} onChange={(e) => setAudience(e.target.value as any)}
        className="w-full rounded-full border border-border bg-surface px-3 py-2 text-sm">
        <option value="all">Toți utilizatorii</option>
        <option value="verified">Doar verificați</option>
        <option value="business">Doar business</option>
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titlu" maxLength={120}
        className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mesaj" maxLength={500} rows={4}
        className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm" />
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (opțional)"
        className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm" />
      <button onClick={submit} disabled={busy}
        className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
        <Send className="mr-1 inline size-4" /> Trimite
      </button>
    </div>
  );
}

/* ---------------- REPORTS ---------------- */
function ReportsPanel({ meId }: { meId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase
        .from("reports").select("*").eq("status", "pending")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r) => r.reported_id)));
      const profilesMap = new Map<string, any>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("id, display_name, report_count, suspended_until").in("id", ids);
        profs?.forEach((p) => profilesMap.set(p.id, p));
      }
      setReports((data ?? []).map((r) => ({ ...r, reported_profile: profilesMap.get(r.reported_id) ?? null })) as Report[]);
    } catch (e: any) {
      const m = e?.message ?? String(e); setError(m); toast.error(m);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const suspend = async (userId: string, hours: number, reason: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("moderator_suspend_user", { _target: userId, _hours: hours, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(hours > 0 ? `Suspendat ${hours}h` : "Anulat"); load();
  };
  const ban = async (userId: string) => {
    const reason = prompt("Motiv ban:"); if (!reason) return;
    if (!confirm("Ban permanent?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("moderator_ban_user", { _target: userId, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Banat"); load();
  };
  const resolve = async (id: string, dismissed = false) => {
    setBusy(true);
    const { error } = await supabase.from("reports")
      .update({ status: dismissed ? "dismissed" : "resolved", resolved_at: new Date().toISOString(), resolved_by: meId })
      .eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setReports((r) => r.filter((x) => x.id !== id));
  };

  if (error) return <AdminPanelError error={error} onRetry={load} />;
  if (loading) return <AdminPanelEmpty label="Se încarcă rapoartele…" />;
  if (reports.length === 0) return <AdminPanelEmpty label="🎉 Nimic de moderat (empty legitim — nicio raportare în așteptare)." />;

  const columns: Column<Report>[] = [
    {
      key: "reason",
      header: "Motiv",
      cell: (r) => <StatusBadge tone="rejected">{r.reason}</StatusBadge>,
      sortValue: (r) => r.reason,
    },
    {
      key: "target",
      header: "Țintă",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{r.reported_profile?.display_name ?? "—"}</div>
          <div className="admin-mono truncate text-[10px] text-[var(--admin-text-faint)]">{r.reported_id}</div>
        </div>
      ),
      sortValue: (r) => r.reported_profile?.display_name ?? "",
      searchValue: (r) => `${r.reported_profile?.display_name ?? ""} ${r.reported_id}`,
    },
    {
      key: "count",
      header: "#Rap",
      align: "right",
      priority: 2,
      cell: (r) => <MonoNumber value={r.reported_profile?.report_count ?? 0} className={(r.reported_profile?.report_count ?? 0) >= 3 ? "text-[var(--admin-warn)]" : ""} />,
      sortValue: (r) => r.reported_profile?.report_count ?? 0,
    },
    {
      key: "details",
      header: "Detalii",
      priority: 3,
      cell: (r) => <span className="line-clamp-2 max-w-[280px] text-[11px] text-[var(--admin-text-dim)]">{r.details ?? "—"}</span>,
      searchValue: (r) => r.details ?? "",
    },
    {
      key: "when",
      header: "Când",
      priority: 2,
      cell: (r) => <span className="admin-mono text-[10px] text-[var(--admin-text-dim)]">{new Date(r.created_at).toLocaleString("ro-RO")}</span>,
      sortValue: (r) => r.created_at,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => (
        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button disabled={busy} onClick={() => suspend(r.reported_id, 24, r.reason)} className="rounded-md bg-[var(--admin-warn-soft)] px-2 py-1 text-[10px] text-[var(--admin-warn)]"><Ban className="inline size-3" />24h</button>
          <button disabled={busy} onClick={() => suspend(r.reported_id, 168, r.reason)} className="rounded-md bg-[var(--admin-danger-soft)] px-2 py-1 text-[10px] text-[var(--admin-danger)]"><Ban className="inline size-3" />7z</button>
          <button disabled={busy} onClick={() => ban(r.reported_id)} className="rounded-md bg-[var(--admin-danger-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--admin-danger)]">Ban</button>
          <button disabled={busy} onClick={() => resolve(r.id, false)} className="rounded-md bg-[var(--admin-success-soft)] px-2 py-1 text-[10px] text-[var(--admin-success)]"><Check className="inline size-3" /></button>
          <button disabled={busy} onClick={() => resolve(r.id, true)} className="rounded-md border border-[var(--admin-border)] px-2 py-1 text-[10px] text-[var(--admin-text-dim)]"><X className="inline size-3" /></button>
        </div>
      ),
    },
  ];

  return <DataTable rows={reports} columns={columns} rowKey={(r) => r.id} exportName="rapoarte" searchPlaceholder="Filtrare locală rapoarte…" />;
}

/* ---------------- RISK ---------------- */
function RiskPanel() {
  const [risk, setRisk] = useState<RiskRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.rpc("admin_risk_queue", { _limit: 100 });
    setLoading(false);
    if (error) { setError(error.message); toast.error(error.message); return; }
    setRisk((data ?? []) as RiskRow[]);
  };
  useEffect(() => { load(); }, []);

  const verify = async (uid: string) => { setBusy(true); const { error } = await supabase.rpc("moderator_verify_user", { _target: uid }); setBusy(false); if (error) return toast.error(error.message); toast.success("Verificat"); load(); };
  const warn = async (uid: string) => { const reason = prompt("Motiv:"); if (!reason) return; setBusy(true); const { error } = await supabase.rpc("moderator_warn_user", { _target: uid, _reason: reason }); setBusy(false); if (error) return toast.error(error.message); toast.success("Avertizat"); load(); };
  const suspend = async (uid: string, hours: number) => { setBusy(true); const { error } = await supabase.rpc("moderator_suspend_user", { _target: uid, _hours: hours, _reason: "risc" }); setBusy(false); if (error) return toast.error(error.message); toast.success(`Suspend ${hours}h`); load(); };
  const ban = async (uid: string) => { const reason = prompt("Motiv ban:"); if (!reason) return; if (!confirm("Ban permanent?")) return; setBusy(true); const { error } = await supabase.rpc("moderator_ban_user", { _target: uid, _reason: reason }); setBusy(false); if (error) return toast.error(error.message); toast.success("Banat"); load(); };

  if (error) return <AdminPanelError error={error} onRetry={load} />;
  if (loading) return <AdminPanelEmpty label="Se calculează coada de risc…" />;
  if (risk.length === 0) return <AdminPanelEmpty label="✅ Niciun risc detectat (empty legitim)." />;

  const riskTone = (n: number): "rejected" | "pending" | "info" => (n >= 80 ? "rejected" : n >= 60 ? "pending" : "info");
  const cols: Column<RiskRow>[] = [
    {
      key: "score",
      header: "Risc",
      align: "right",
      cell: (r) => <StatusBadge tone={riskTone(r.risk_score)}><MonoNumber value={r.risk_score} /></StatusBadge>,
      sortValue: (r) => r.risk_score,
    },
    {
      key: "user",
      header: "Utilizator",
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1 truncate font-medium">
            {r.display_name ?? "(fără nume)"}
            {r.verified && <BadgeCheck className="size-3 text-[var(--admin-accent)]" />}
          </div>
          <div className="admin-mono truncate text-[10px] text-[var(--admin-text-faint)]">{r.user_id}</div>
        </div>
      ),
      sortValue: (r) => r.display_name ?? "",
      searchValue: (r) => `${r.display_name ?? ""} ${r.user_id}`,
    },
    {
      key: "flags",
      header: "Flag-uri",
      priority: 2,
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.duplicate_photo_accounts > 0 && <StatusBadge tone="rejected">poză dup ×{r.duplicate_photo_accounts}</StatusBadge>}
          {r.report_count > 0 && <StatusBadge tone="pending">{r.report_count} rap</StatusBadge>}
          {r.banned_at && <StatusBadge tone="banned">banat</StatusBadge>}
        </div>
      ),
    },
    {
      key: "kinds",
      header: "Recent",
      priority: 3,
      cell: (r) => <span className="text-[10px] uppercase text-[var(--admin-text-faint)]">{r.recent_flag_kinds.join(" · ") || "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => (
        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button disabled={busy} onClick={() => verify(r.user_id)} className="rounded-md bg-[var(--admin-accent-soft)] px-2 py-1 text-[10px] text-[var(--admin-accent)]"><ShieldCheck className="inline size-3" /></button>
          <button disabled={busy} onClick={() => warn(r.user_id)} className="rounded-md bg-[var(--admin-warn-soft)] px-2 py-1 text-[10px] text-[var(--admin-warn)]"><AlertTriangle className="inline size-3" /></button>
          <button disabled={busy} onClick={() => suspend(r.user_id, 24)} className="rounded-md bg-[var(--admin-warn-soft)] px-2 py-1 text-[10px] text-[var(--admin-warn)]">24h</button>
          <button disabled={busy} onClick={() => suspend(r.user_id, 168)} className="rounded-md bg-[var(--admin-danger-soft)] px-2 py-1 text-[10px] text-[var(--admin-danger)]">7z</button>
          <button disabled={busy} onClick={() => ban(r.user_id)} className="rounded-md bg-[var(--admin-danger-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--admin-danger)]">Ban</button>
        </div>
      ),
    },
  ];
  return <DataTable rows={risk} columns={cols} rowKey={(r) => r.user_id} exportName="risc" searchPlaceholder="Filtrare risc…" />;
}

/* ---------------- ADS ---------------- */
function AdsPanel() {
  const [ads, setAds] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase
        .from("ad_campaigns")
        .select("id, title, body, placement, status, city, cta_url, image_url, starts_at, ends_at, budget_cents, impressions, clicks, advertiser_id")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((c) => c.advertiser_id)));
      const map = new Map<string, string>();
      if (ids.length) {
        const { data: advs } = await supabase.from("advertisers").select("id, brand_name").in("id", ids);
        advs?.forEach((a) => map.set(a.id, a.brand_name));
      }
      setAds((data ?? []).map((c) => ({ ...c, brand_name: map.get(c.advertiser_id) ?? null })));
    } catch (e: any) {
      const m = e?.message ?? String(e); setError(m); toast.error(m);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setBusy(true);
    const { error } = await supabase.from("ad_campaigns").update({ status }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${status}`); load();
  };

  if (error) return <AdminPanelError error={error} onRetry={load} />;
  if (loading) return <AdminPanelEmpty label="Se încarcă campaniile…" />;
  if (ads.length === 0) return <AdminPanelEmpty label="Nicio campanie publicitară (empty legitim — niciun advertiser nu a publicat încă)." />;

  const statusTone = (s: string): "approved" | "pending" | "rejected" | "neutral" =>
    s === "active" ? "approved" : s === "pending" ? "pending" : s === "rejected" ? "rejected" : "neutral";

  const cols: Column<any>[] = [
    { key: "status", header: "Status", cell: (a) => <StatusBadge tone={statusTone(a.status)}>{a.status}</StatusBadge>, sortValue: (a) => a.status },
    {
      key: "title",
      header: "Campanie",
      cell: (a) => (
        <div className="flex items-center gap-2">
          {a.image_url && <img src={a.image_url} alt="" className="size-8 shrink-0 rounded object-cover" />}
          <div className="min-w-0">
            <div className="truncate font-medium">{a.title}</div>
            <div className="truncate text-[10px] text-[var(--admin-text-faint)]">{a.brand_name ?? a.advertiser_id?.slice(0, 8)}</div>
          </div>
        </div>
      ),
      sortValue: (a) => a.title,
      searchValue: (a) => `${a.title} ${a.body ?? ""} ${a.brand_name ?? ""}`,
    },
    { key: "placement", header: "Plasare", priority: 2, cell: (a) => <StatusBadge tone="info">{a.placement}</StatusBadge>, sortValue: (a) => a.placement },
    { key: "city", header: "Oraș", priority: 3, cell: (a) => <span className="text-xs text-[var(--admin-text-dim)]">{a.city ?? "—"}</span>, sortValue: (a) => a.city ?? "" },
    { key: "budget", header: "Buget", align: "right", priority: 2, cell: (a) => <MonoNumber value={(a.budget_cents / 100).toFixed(0)} suffix=" RON" />, sortValue: (a) => a.budget_cents ?? 0 },
    { key: "imp", header: "Imp", align: "right", priority: 3, cell: (a) => <MonoNumber value={a.impressions} />, sortValue: (a) => a.impressions ?? 0 },
    { key: "clk", header: "Click", align: "right", priority: 3, cell: (a) => <MonoNumber value={a.clicks} />, sortValue: (a) => a.clicks ?? 0 },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (a) => {
        const isActive = a.status === "active";
        return (
          <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {!isActive && <button disabled={busy} onClick={() => setStatus(a.id, "active")} className="rounded-md bg-[var(--admin-success-soft)] px-2 py-1 text-[10px] text-[var(--admin-success)]"><Play className="inline size-3" /></button>}
            {isActive && <button disabled={busy} onClick={() => setStatus(a.id, "paused")} className="rounded-md bg-[var(--admin-warn-soft)] px-2 py-1 text-[10px] text-[var(--admin-warn)]"><Pause className="inline size-3" /></button>}
            <button disabled={busy} onClick={() => setStatus(a.id, "rejected")} className="rounded-md bg-[var(--admin-danger-soft)] px-2 py-1 text-[10px] text-[var(--admin-danger)]"><X className="inline size-3" /></button>
            <button disabled={busy} onClick={() => setStatus(a.id, "ended")} className="rounded-md border border-[var(--admin-border)] px-2 py-1 text-[10px] text-[var(--admin-text-dim)]">Termină</button>
          </div>
        );
      },
    },
  ];
  return <DataTable rows={ads} columns={cols} rowKey={(a) => a.id} exportName="ads" searchPlaceholder="Filtrare ads…" />;
}

/* ---------------- BIZ ---------------- */
function BizPanel() {
  const [apps, setApps] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from("business_applications").select("*")
      .in("status", ["pending", "reviewing"])
      .order("created_at", { ascending: false }).limit(200);
    setLoading(false);
    if (error) { setError(error.message); toast.error(error.message); return; }
    setApps(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: "approved" | "rejected" | "reviewing") => {
    setBusy(true);
    const { error } = await supabase.from("business_applications").update({ status }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Aprobat — rol business acordat" : status); load();
  };

  if (error) return <AdminPanelError error={error} onRetry={load} />;
  if (loading) return <AdminPanelEmpty label="Se încarcă cererile B2B…" />;
  if (apps.length === 0) return <AdminPanelEmpty label="Nicio cerere B2B în așteptare (empty legitim)." />;

  const cols: Column<any>[] = [
    { key: "status", header: "Status", cell: (a) => <StatusBadge tone={a.status === "reviewing" ? "info" : "pending"}>{a.status}</StatusBadge>, sortValue: (a) => a.status },
    {
      key: "brand",
      header: "Companie",
      cell: (a) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{a.brand_name ?? a.legal_name}</div>
          <div className="truncate text-[10px] text-[var(--admin-text-faint)]">{a.legal_name} · CUI {a.cui ?? "—"}</div>
        </div>
      ),
      sortValue: (a) => a.brand_name ?? a.legal_name ?? "",
      searchValue: (a) => `${a.brand_name ?? ""} ${a.legal_name ?? ""} ${a.cui ?? ""} ${a.contact_email ?? ""} ${a.city ?? ""}`,
    },
    { key: "entity", header: "Tip", priority: 2, cell: (a) => <StatusBadge tone="neutral">{a.entity_type}</StatusBadge>, sortValue: (a) => a.entity_type },
    { key: "city", header: "Oraș", priority: 3, cell: (a) => <span className="text-xs text-[var(--admin-text-dim)]">{a.city ?? "—"}</span>, sortValue: (a) => a.city ?? "" },
    { key: "cat", header: "Categ.", priority: 3, cell: (a) => <span className="text-xs text-[var(--admin-text-dim)]">{a.category ?? "—"}</span>, sortValue: (a) => a.category ?? "" },
    {
      key: "contact",
      header: "Contact",
      priority: 2,
      cell: (a) => (
        <div className="min-w-0">
          <div className="truncate text-xs">{a.contact_name}</div>
          <a href={`mailto:${a.contact_email}`} className="admin-mono block truncate text-[10px] text-[var(--admin-accent)] hover:underline">{a.contact_email}</a>
        </div>
      ),
      sortValue: (a) => a.contact_email ?? "",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (a) => (
        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button disabled={busy} onClick={() => setStatus(a.id, "approved")} className="rounded-md bg-[var(--admin-success-soft)] px-2 py-1 text-[10px] text-[var(--admin-success)]"><Check className="inline size-3" /> Aprobă</button>
          <button disabled={busy} onClick={() => setStatus(a.id, "reviewing")} className="rounded-md bg-blue-500/15 px-2 py-1 text-[10px] text-blue-300">Review</button>
          <button disabled={busy} onClick={() => setStatus(a.id, "rejected")} className="rounded-md bg-[var(--admin-danger-soft)] px-2 py-1 text-[10px] text-[var(--admin-danger)]"><X className="inline size-3" /></button>
        </div>
      ),
    },
  ];
  return <DataTable rows={apps} columns={cols} rowKey={(a) => a.id} exportName="b2b" searchPlaceholder="Filtrare cereri B2B…" />;
}
