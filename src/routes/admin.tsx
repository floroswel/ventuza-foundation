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
} from "lucide-react";
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
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { FeedbackInbox } from "@/components/admin/FeedbackInbox";
import { ExperimentsPanel } from "@/components/admin/ExperimentsPanel";
import { isProductionHost, shouldEnforceAgeGate, clearAgeGatePolicyCache } from "@/lib/age-gate-policy";
import { DemoSeedPanel, DemoSeedBanner } from "@/components/admin/DemoSeedPanel";


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
  | "partners" | "demoseed";

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


  const allItems: { id: Section; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, adminOnly: true },
    { id: "alerts", label: "Alerte", icon: Bell },
    { id: "users", label: "Utilizatori", icon: Users, adminOnly: true },
    { id: "reports", label: "Rapoarte", icon: ShieldAlert },
    { id: "risk", label: "Risc", icon: AlertTriangle },
    { id: "csam", label: "CSAM", icon: ShieldAlert, adminOnly: true },
    { id: "dsa", label: "DSA", icon: FileWarning },
    { id: "gdpr", label: "GDPR", icon: Download, adminOnly: true },
    { id: "breakglass", label: "Break-glass", icon: ShieldAlert, adminOnly: true },
    { id: "breach", label: "Breșe", icon: AlertOctagon, adminOnly: true },
    { id: "policies", label: "Politici", icon: FileText },
    { id: "audit", label: "Audit", icon: ScrollText },
    { id: "ads", label: "Ads", icon: Megaphone },
    { id: "biz", label: "B2B", icon: Building2 },
    { id: "partners", label: "Parteneri & Moderare", icon: ShieldCheck },
    { id: "data", label: "Date (toate)", icon: Database, adminOnly: true },
    { id: "broadcast", label: "Broadcast", icon: Send, adminOnly: true },
    { id: "security", label: "Securitate", icon: KeyRound },
    { id: "demoseed", label: "Demo seed", icon: Sparkles, adminOnly: true },
  ];
  const items = allItems.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Crown className="size-5 text-primary" />
          <h1 className="text-base font-semibold">Admin Control Center</h1>
          <span className="ml-auto text-xs text-muted-foreground">{isAdmin ? "ADMIN" : "MOD"} · idle-out 15m</span>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2 scrollbar-none">
          {items.map((it) => (
            <button key={it.id} onClick={() => setSection(it.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                section === it.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-surface"
              }`}>
              <it.icon className="size-3.5" /> {it.label}
            </button>
          ))}
        </nav>
      </header>

      {/* AGE-GATE WARNING BANNER — vizibil dacă flag age_verification e OFF în non-prod.
          TODO[age-gate]: la reactivare (toggle ON din admin → Securitate/Feature flags),
          banner-ul dispare automat. Producția forțează ON via age-gate-policy. */}
      <AgeGateDevBanner />
      <DemoSeedBanner />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {section === "overview" && isAdmin && <OverviewPanel />}
        {section === "alerts" && <AlertsPanel />}
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
        {section === "security" && <SecurityPanel />}
        {section === "demoseed" && isAdmin && <DemoSeedPanel isSuperAdmin={isSuper} />}
      </main>
    </div>
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

  if (loading) return <Loader2 className="mx-auto mt-12 size-6 animate-spin" />;
  if (error) return <AdminPanelError error={error} onRetry={load} />;
  if (!data) return <AdminPanelEmpty label="Fără date." />;


  const Stat = ({ label, value, hint }: { label: string; value: number | string; hint?: string }) => (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <AnalyticsPanel />
      <FeedbackInbox />
      <ExperimentsPanel />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Privire de ansamblu</h2>
        <button onClick={load} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface">
          <RefreshCw className="mr-1 inline size-3" /> Reîncarcă
        </button>
      </div>


      <section>
        <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Utilizatori</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total" value={data.profiles.total} />
          <Stat label="Noi 24h" value={data.profiles.last24h} />
          <Stat label="Noi 7 zile" value={data.profiles.last7d} />
          <Stat label="Verificați" value={data.profiles.verified} />
          <Stat label="Suspendați" value={data.profiles.suspended} />
          <Stat label="Banați" value={data.profiles.banned} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Activitate</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="Mesaje 24h" value={data.activity.messages24h} />
          <Stat label="Match-uri 24h" value={data.activity.matches24h} />
          <Stat label="Evenimente" value={data.activity.events} />
          <Stat label="Eveniment noi 24h" value={data.activity.events24h} />
          <Stat label="SOS 7 zile" value={data.activity.sos7d} hint="Verifică urgent" />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Moderare & Business</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="Rapoarte pending" value={data.moderation.reportsPending} />
          <Stat label="Ads active" value={data.moderation.adsActive} />
          <Stat label="Ads pending" value={data.moderation.adsPending} />
          <Stat label="B2B pending" value={data.moderation.bizPending} />
          <Stat label="Abonamente active" value={data.moderation.subsActive} />
        </div>
      </section>
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

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)}
            placeholder="Caută după nume, oraș sau UUID..."
            className="w-full rounded-full border border-border bg-surface py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button onClick={() => load(q)} disabled={busy} className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">
          Caută
        </button>
      </div>

      {error && <AdminPanelError error={error} onRetry={() => load(q)} />}
      {busy && rows.length === 0 && !error && <AdminPanelEmpty label="Se încarcă…" />}

      <ul className="space-y-2">
        {rows.map((u) => (
          <li key={u.id} className="rounded-2xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{u.display_name ?? "(fără nume)"}</p>
                  {u.verified && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">verificat</span>}
                  {u.banned_at && <span className="rounded-full bg-red-700/20 px-2 py-0.5 text-[10px] text-red-400">banat</span>}
                  {u.suspended_until && new Date(u.suspended_until) > new Date() && (
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] text-orange-500">suspendat</span>
                  )}
                  {u.roles.map((r: string) => (
                    <span key={r} className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-400">{r}</span>
                  ))}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{u.id} · {u.city ?? "—"} · Lv{u.level} · {u.xp} XP · {u.report_count ?? 0} rapoarte</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setDetailId(u.id)} className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary">
                  Detalii / break-glass
                </button>
                {(["admin", "moderator", "business"] as const).map((r) => {
                  const has = u.roles.includes(r);
                  return (
                    <button key={r} onClick={() => toggleRole(u.id, r, has)}
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${has ? "bg-blue-500/20 text-blue-400" : "border border-border text-muted-foreground"}`}>
                      {has ? "−" : "+"} {r}
                    </button>
                  );
                })}
                {u.id !== meId && (
                  <button onClick={() => deleteUser(u.id)} className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-medium text-red-500">
                    <Trash2 className="inline size-3" /> Șterge
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
        {rows.length === 0 && !busy && (
          <li className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">Niciun rezultat.</li>
        )}
      </ul>
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

  const load = async () => {
    const { data, error } = await supabase
      .from("reports").select("*").eq("status", "pending")
      .order("created_at", { ascending: false }).limit(100);
    if (error) return toast.error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r) => r.reported_id)));
    const profilesMap = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("id, display_name, report_count, suspended_until").in("id", ids);
      profs?.forEach((p) => profilesMap.set(p.id, p));
    }
    setReports((data ?? []).map((r) => ({ ...r, reported_profile: profilesMap.get(r.reported_id) ?? null })) as Report[]);
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

  if (reports.length === 0) {
    return <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">🎉 Nimic de moderat</div>;
  }
  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">{r.reason}</span>
            {r.reported_profile?.report_count && r.reported_profile.report_count >= 3 && (
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-500">{r.reported_profile.report_count} rapoarte</span>
            )}
          </div>
          <p className="mt-2 text-sm font-medium">{r.reported_profile?.display_name ?? r.reported_id.slice(0, 8)}</p>
          {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
          <p className="mt-1 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ro-RO")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => suspend(r.reported_id, 24, r.reason)} className="rounded-full bg-orange-500/15 px-3 py-1.5 text-xs text-orange-500"><Ban className="mr-1 inline size-3" />24h</button>
            <button disabled={busy} onClick={() => suspend(r.reported_id, 168, r.reason)} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-500"><Ban className="mr-1 inline size-3" />7 zile</button>
            <button disabled={busy} onClick={() => ban(r.reported_id)} className="rounded-full bg-red-700/20 px-3 py-1.5 text-xs text-red-400">Ban</button>
            <button disabled={busy} onClick={() => resolve(r.id, false)} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs text-primary"><Check className="mr-1 inline size-3" />Rezolvat</button>
            <button disabled={busy} onClick={() => resolve(r.id, true)} className="rounded-full border border-border px-3 py-1.5 text-xs"><X className="mr-1 inline size-3" />Respinge</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- RISK ---------------- */
function RiskPanel() {
  const [risk, setRisk] = useState<RiskRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_risk_queue", { _limit: 100 });
    if (error) return toast.error(error.message);
    setRisk((data ?? []) as RiskRow[]);
  };
  useEffect(() => { load(); }, []);

  const verify = async (uid: string) => { setBusy(true); const { error } = await supabase.rpc("moderator_verify_user", { _target: uid }); setBusy(false); if (error) return toast.error(error.message); toast.success("Verificat"); load(); };
  const warn = async (uid: string) => { const reason = prompt("Motiv:"); if (!reason) return; setBusy(true); const { error } = await supabase.rpc("moderator_warn_user", { _target: uid, _reason: reason }); setBusy(false); if (error) return toast.error(error.message); toast.success("Avertizat"); load(); };
  const suspend = async (uid: string, hours: number) => { setBusy(true); const { error } = await supabase.rpc("moderator_suspend_user", { _target: uid, _hours: hours, _reason: "risc" }); setBusy(false); if (error) return toast.error(error.message); toast.success(`Suspend ${hours}h`); load(); };
  const ban = async (uid: string) => { const reason = prompt("Motiv ban:"); if (!reason) return; if (!confirm("Ban permanent?")) return; setBusy(true); const { error } = await supabase.rpc("moderator_ban_user", { _target: uid, _reason: reason }); setBusy(false); if (error) return toast.error(error.message); toast.success("Banat"); load(); };

  if (risk.length === 0) return <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">✅ Niciun risc detectat</div>;
  return (
    <ul className="space-y-3">
      {risk.map((r) => {
        const c = r.risk_score >= 80 ? "text-red-500 bg-red-500/15" : r.risk_score >= 60 ? "text-orange-500 bg-orange-500/15" : "text-yellow-500 bg-yellow-500/10";
        return (
          <li key={r.user_id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c}`}>Risc {r.risk_score}</span>
              {r.verified && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary"><BadgeCheck className="mr-0.5 inline size-3" />verificat</span>}
              {r.duplicate_photo_accounts > 0 && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-500">poză dup × {r.duplicate_photo_accounts}</span>}
              {r.report_count > 0 && <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-500">{r.report_count} rap</span>}
              {r.banned_at && <span className="rounded-full bg-red-700/20 px-2 py-0.5 text-[10px] text-red-400">banat</span>}
            </div>
            <p className="mt-2 text-sm font-medium">{r.display_name ?? r.user_id.slice(0, 8)}</p>
            {r.recent_flag_kinds.length > 0 && <p className="mt-1 text-[10px] uppercase text-muted-foreground">{r.recent_flag_kinds.join(" · ")}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => verify(r.user_id)} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs text-primary"><ShieldCheck className="mr-1 inline size-3" />Verifică</button>
              <button disabled={busy} onClick={() => warn(r.user_id)} className="rounded-full bg-yellow-500/15 px-3 py-1.5 text-xs text-yellow-500"><AlertTriangle className="mr-1 inline size-3" />Warn</button>
              <button disabled={busy} onClick={() => suspend(r.user_id, 24)} className="rounded-full bg-orange-500/15 px-3 py-1.5 text-xs text-orange-500"><Ban className="mr-1 inline size-3" />24h</button>
              <button disabled={busy} onClick={() => suspend(r.user_id, 168)} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-500"><Ban className="mr-1 inline size-3" />7 zile</button>
              <button disabled={busy} onClick={() => ban(r.user_id)} className="rounded-full bg-red-700/20 px-3 py-1.5 text-xs text-red-400">Ban</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- ADS ---------------- */
function AdsPanel() {
  const [ads, setAds] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select("id, title, body, placement, status, city, cta_url, image_url, starts_at, ends_at, budget_cents, impressions, clicks, advertiser_id")
      .order("created_at", { ascending: false }).limit(200);
    if (error) return toast.error(error.message);
    const ids = Array.from(new Set((data ?? []).map((c) => c.advertiser_id)));
    const map = new Map<string, string>();
    if (ids.length) {
      const { data: advs } = await supabase.from("advertisers").select("id, brand_name").in("id", ids);
      advs?.forEach((a) => map.set(a.id, a.brand_name));
    }
    setAds((data ?? []).map((c) => ({ ...c, brand_name: map.get(c.advertiser_id) ?? null })));
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setBusy(true);
    const { error } = await supabase.from("ad_campaigns").update({ status }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${status}`); load();
  };

  if (ads.length === 0) return <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">Nicio campanie.</div>;
  return (
    <ul className="space-y-3">
      {ads.map((a) => {
        const isActive = a.status === "active";
        const sc = isActive ? "bg-green-500/15 text-green-500" : a.status === "pending" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground";
        return (
          <li key={a.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sc}`}>{a.status}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{a.placement}</span>
                  {a.city && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{a.city}</span>}
                </div>
                <p className="mt-2 text-sm font-medium">{a.title}</p>
                <p className="text-[10px] text-muted-foreground">{a.brand_name ?? a.advertiser_id.slice(0, 8)} · {a.budget_cents / 100} RON · {a.impressions} imp · {a.clicks} click</p>
                {a.body && <p className="mt-1 text-xs text-muted-foreground">{a.body}</p>}
              </div>
              {a.image_url && <img src={a.image_url} alt="" className="size-16 rounded-lg object-cover" />}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!isActive && <button disabled={busy} onClick={() => setStatus(a.id, "active")} className="rounded-full bg-green-500/15 px-3 py-1.5 text-xs text-green-500"><Play className="mr-1 inline size-3" />Activează</button>}
              {isActive && <button disabled={busy} onClick={() => setStatus(a.id, "paused")} className="rounded-full bg-yellow-500/15 px-3 py-1.5 text-xs text-yellow-500"><Pause className="mr-1 inline size-3" />Pauză</button>}
              <button disabled={busy} onClick={() => setStatus(a.id, "rejected")} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-500"><X className="mr-1 inline size-3" />Respinge</button>
              <button disabled={busy} onClick={() => setStatus(a.id, "ended")} className="rounded-full border border-border px-3 py-1.5 text-xs">Termină</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- BIZ ---------------- */
function BizPanel() {
  const [apps, setApps] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("business_applications").select("*")
      .in("status", ["pending", "reviewing"])
      .order("created_at", { ascending: false }).limit(200);
    if (error) return toast.error(error.message);
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

  if (apps.length === 0) return <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">Nicio cerere B2B în așteptare.</div>;
  return (
    <ul className="space-y-3">
      {apps.map((a) => (
        <li key={a.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase text-amber-500">{a.status}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{a.entity_type}</span>
          </div>
          <p className="mt-2 text-sm font-semibold">{a.brand_name ?? a.legal_name}</p>
          <p className="text-[10px] text-muted-foreground">{a.legal_name} · CUI {a.cui ?? "—"} · {a.city ?? "—"} · {a.category ?? "—"}</p>
          <p className="mt-1 text-xs">{a.contact_name} · {a.contact_email} · {a.contact_phone ?? "—"}</p>
          {a.website && <a href={a.website} target="_blank" rel="noopener" className="text-[10px] text-primary">{a.website}</a>}
          {a.goals && <p className="mt-1 text-xs text-muted-foreground">{a.goals}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => setStatus(a.id, "approved")} className="rounded-full bg-green-500/15 px-3 py-1.5 text-xs text-green-500"><Check className="mr-1 inline size-3" />Aprobă</button>
            <button disabled={busy} onClick={() => setStatus(a.id, "reviewing")} className="rounded-full bg-blue-500/15 px-3 py-1.5 text-xs text-blue-500">Reviewing</button>
            <button disabled={busy} onClick={() => setStatus(a.id, "rejected")} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-500"><X className="mr-1 inline size-3" />Respinge</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
