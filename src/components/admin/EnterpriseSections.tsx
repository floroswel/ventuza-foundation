import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminGetAuditLog, adminGetAlerts, adminAckAlert, adminSnoozeAlert, adminResolveAlert,
  adminGetDsaReports, adminResolveDsa,
  adminGetCsamReports, adminAddCsamHash,
  adminGetDeletionRequests, adminExportUserData, adminProcessDeletion,
  adminGetBreaches, adminCreateBreach,
  adminGetPolicies, adminCreatePolicy,
  adminGetMyMfa, adminMarkMfaEnrolled,
} from "@/lib/admin-enterprise.functions";
import {
  ScrollText, Bell, ShieldAlert, FileWarning, Download, Trash2,
  KeyRound, FileText, RefreshCw, Plus, CheckCircle2, AlertOctagon,
} from "lucide-react";
import { useAdminPanelLoad, PanelStatus } from "@/components/admin/PanelStatus";

// Helper: extrage mesajul de eroare din ce ne dă serverul (server fns aruncă Error,
// uneori cu prefix "Forbidden:" / "denied" → afișăm clar utilizatorului DE CE).
const errMsg = (e: any): string => e?.message ?? String(e ?? "Eroare necunoscută");

/**
 * Banner inline standard de eroare pentru panourile admin.
 * Vezi REGULĂ — ADMIN PANELS în AGENTS.md: query picat afișează eroarea,
 * NU spinner etern și NU empty state mascat.
 */
function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const forbidden = /forbidden|denied|insufficient|not allowed|rol|role/i.test(error);
  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
      <p className="font-semibold text-red-300">{forbidden ? "Acces refuzat" : "Eroare la încărcare"}</p>
      <p className="mt-1 break-words text-xs text-red-200/90">{error}</p>
      {forbidden && (
        <p className="mt-2 text-[11px] text-red-200/70">
          Acest panou cere un rol pe care contul tău nu îl are (ex: <code>super_admin</code> / <code>auditor</code>).
        </p>
      )}
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10">
          Reîncearcă
        </button>
      )}
    </div>
  );
}
function LoadingBox({ label = "Se încarcă…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-8 text-sm text-muted-foreground">
      <RefreshCw className="size-4 animate-spin" /> {label}
    </div>
  );
}

/* =========================================================
   AUDIT LOG
========================================================= */
export function AuditLogPanel() {
  const fetchLog = useServerFn(adminGetAuditLog);
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [targetTable, setTargetTable] = useState("");
  const [actorId, setActorId] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [limit, setLimit] = useState(200);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // helper: convertește input datetime-local (ora locală) la ISO UTC
  const toIso = (v: string) => (v ? new Date(v).toISOString() : undefined);

  const buildPayload = (overrideLimit?: number) => ({
    search: search.trim() || undefined,
    action: action.trim() || undefined,
    severity: (severity as any) || undefined,
    targetTable: targetTable.trim() || undefined,
    actorId: actorId.trim() && /^[0-9a-f-]{36}$/i.test(actorId.trim()) ? actorId.trim() : undefined,
    since: toIso(since),
    until: toIso(until),
    limit: overrideLimit ?? limit,
  });

  const load = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetchLog({ data: buildPayload() });
      setRows(r.rows); setCount(r.count);
    } catch (e: any) {
      const m = errMsg(e); setError(m); toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const resetFilters = () => {
    setSearch(""); setAction(""); setSeverity(""); setTargetTable("");
    setActorId(""); setSince(""); setUntil(""); setLimit(200);
  };

  const downloadBlob = (content: string, mime: string, ext: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export: refetch cu limită mare ca să cuprindă tot ce match-uiește filtrele,
  // nu doar pagina vizibilă. Plafonat la 1000 (limita serverului).
  const fetchAllForExport = async () => {
    const r = await fetchLog({ data: buildPayload(1000) });
    if (r.rows.length < r.count) {
      toast.warning(`Export limitat la 1000 din ${r.count} înregistrări. Restrânge filtrul pentru export complet.`);
    }
    return r.rows;
  };

  const exportCsv = async () => {
    try {
      setBusy(true);
      const data = await fetchAllForExport();
      const cols = ["created_at", "actor_id", "action", "severity", "target_table", "target_id", "justification", "ip", "user_agent"];
      const esc = (v: any) => {
        const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const lines = [cols.join(",")];
      data.forEach((r: any) => lines.push(cols.map((c) => esc(r[c])).join(",")));
      downloadBlob(lines.join("\n"), "text/csv;charset=utf-8", "csv");
      toast.success(`Exportat ${data.length} înregistrări (CSV)`);
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  };

  const exportJson = async () => {
    try {
      setBusy(true);
      const data = await fetchAllForExport();
      downloadBlob(JSON.stringify(data, null, 2), "application/json", "json");
      toast.success(`Exportat ${data.length} înregistrări (JSON)`);
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  };

  const inputCls = "rounded-full border border-border bg-surface px-3 py-1.5 text-xs";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ScrollText className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Jurnal audit (imutabil)</h2>
        <span className="text-xs text-muted-foreground">{count} înregistrări</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={exportCsv} disabled={busy} className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-50">
            <Download className="mr-1 inline size-3" /> CSV
          </button>
          <button onClick={exportJson} disabled={busy} className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-50">
            <Download className="mr-1 inline size-3" /> JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Căutare liberă
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="acțiune / justificare / țintă..." className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Acțiune (exactă)
          <input value={action} onChange={(e) => setAction(e.target.value)}
            placeholder="ex: ban.user" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Tabel țintă
          <input value={targetTable} onChange={(e) => setTargetTable(e.target.value)}
            placeholder="ex: profiles" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Actor (UUID)
          <input value={actorId} onChange={(e) => setActorId(e.target.value)}
            placeholder="00000000-..." className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Severitate
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputCls}>
            <option value="">toate severitățile</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          De la
          <input type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Până la
          <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Limită rezultate
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={inputCls}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </label>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2 pt-1">
          <button onClick={load} disabled={busy} className="rounded-full bg-primary px-4 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
            <RefreshCw className={`mr-1 inline size-3 ${busy ? "animate-spin" : ""}`} /> Caută
          </button>
          <button onClick={resetFilters} disabled={busy} className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-50">
            Resetează filtre
          </button>
          <span className="ml-auto text-[10px] text-muted-foreground">
            Datele folosesc ora locală • export include filtrele active
          </span>
        </div>
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : busy && rows.length === 0 ? (
        <LoadingBox />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-xs">
            <thead className="bg-background/50">
              <tr>
                <th className="px-2 py-2 text-left">Când</th>
                <th className="px-2 py-2 text-left">Acțiune</th>
                <th className="px-2 py-2 text-left">Sev.</th>
                <th className="px-2 py-2 text-left">Actor</th>
                <th className="px-2 py-2 text-left">Țintă</th>
                <th className="px-2 py-2 text-left">Justificare</th>
                <th className="px-2 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sc = r.severity === "critical" ? "bg-red-500/15 text-red-500"
                  : r.severity === "warning" ? "bg-orange-500/15 text-orange-500"
                  : "bg-muted text-muted-foreground";
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-2 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("ro-RO")}</td>
                    <td className="px-2 py-2 font-mono">{r.action}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] ${sc}`}>{r.severity}</span></td>
                    <td className="px-2 py-2 font-mono text-[10px]">{r.actor_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-2 py-2 text-[10px]">{r.target_table ? `${r.target_table}/${(r.target_id ?? "").slice(0, 8)}` : "—"}</td>
                    <td className="px-2 py-2 max-w-[280px] truncate">{r.justification ?? "—"}</td>
                    <td className="px-2 py-2 font-mono text-[10px]">{r.ip ?? "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && !busy && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Niciun eveniment pentru filtrele curente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/* =========================================================
   ALERTS (realtime)
========================================================= */
export function AlertsPanel() {
  const get = useServerFn(adminGetAlerts);
  const ack = useServerFn(adminAckAlert);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try { setItems(await get()); }
    catch (e: any) { const m = errMsg(e); setError(m); toast.error(m); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("admin_alerts_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_alerts" }, (p) => {
        setItems((cur) => [p.new, ...cur]);
        toast.warning(`🚨 ${(p.new as any).title}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const acknowledge = async (id: number) => {
    try { await ack({ data: { id } }); setItems((c) => c.filter((x) => x.id !== id)); }
    catch (e: any) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">Alerte (live)</h2>
        <span className="ml-auto text-xs text-muted-foreground">{items.length} active</span>
      </div>
      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : loading ? (
        <LoadingBox />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          ✅ Nicio alertă activă (empty legitim — apare aici când sistemul detectează un incident)
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const sc = a.severity === "critical" ? "border-red-500/40 bg-red-500/5"
              : a.severity === "warning" ? "border-orange-500/40 bg-orange-500/5"
              : "border-border bg-surface";
            return (
              <li key={a.id} className={`rounded-2xl border p-3 ${sc}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase">{a.kind}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString("ro-RO")}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{a.title}</p>
                    {a.body && <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>}
                  </div>
                  <button onClick={() => acknowledge(a.id)} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs text-primary">
                    <CheckCircle2 className="mr-1 inline size-3" /> Confirmă
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* =========================================================
   DSA reports
========================================================= */
export function DsaPanel() {
  const get = useServerFn(adminGetDsaReports);
  const resolve = useServerFn(adminResolveDsa);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try { setItems(await get()); }
    catch (e: any) { const m = errMsg(e); setError(m); toast.error(m); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, status: "resolved" | "dismissed" | "escalated") => {
    const resolution = prompt(`Notă rezoluție (${status}):`);
    if (!resolution || resolution.length < 3) return;
    try { await resolve({ data: { id, status, resolution } }); toast.success("Procesat"); load(); }
    catch (e: any) { toast.error(errMsg(e)); }
  };

  const visible = items.filter((r) => filter === "all" || r.status === "pending");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileWarning className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">DSA — conținut ilegal</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="ml-auto rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
          <option value="pending">Pending</option><option value="all">Toate</option>
        </select>
      </div>
      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : loading ? (
        <LoadingBox />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">Nimic.</div>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-surface p-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] uppercase text-destructive">{r.category}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{r.status}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString("ro-RO")}</span>
              </div>
              <p className="mt-2 text-sm">{r.description}</p>
              {r.content_url && <p className="mt-1 text-[10px] break-all text-muted-foreground">{r.content_url}</p>}
              <p className="text-[10px] text-muted-foreground italic">raport anonim (DSA / illegal_content_reports)</p>
              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => act(r.id, "resolved")} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs text-primary">Rezolvă</button>
                  <button onClick={() => act(r.id, "escalated")} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-500">Escaladă</button>
                  <button onClick={() => act(r.id, "dismissed")} className="rounded-full border border-border px-3 py-1.5 text-xs">Respinge</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* =========================================================
   CSAM
========================================================= */
export function CsamPanel() {
  const get = useServerFn(adminGetCsamReports);
  const addHash = useServerFn(adminAddCsamHash);
  const [items, setItems] = useState<any[]>([]);
  const [hash, setHash] = useState("");
  const [source, setSource] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try { setItems(await get()); }
    catch (e: any) { const m = errMsg(e); setError(m); toast.error(m); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const j = prompt("Justificare adăugare hash CSAM:");
    if (!j || j.length < 5) return;
    try { await addHash({ data: { hash, source: source || undefined, justification: j } }); toast.success("Adăugat"); setHash(""); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-red-500" />
        <h2 className="text-lg font-semibold">CSAM & siguranță foto</h2>
      </div>

      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-3">
        <p className="text-xs text-red-300">
          Hash-urile adăugate aici blochează automat orice upload care le potrivește.
          Conectează NCMEC/PhotoDNA via secret <code>NCMEC_API_KEY</code> pentru raportare automată.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={hash} onChange={(e) => setHash(e.target.value)} placeholder="pHash / SHA hash"
            className="flex-1 min-w-[200px] rounded-full border border-border bg-background px-3 py-1.5 text-xs font-mono" />
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="sursa (NCMEC/etc)"
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs" />
          <button onClick={submit} disabled={hash.length < 8} className="rounded-full bg-red-500/20 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50">
            <Plus className="mr-1 inline size-3" /> Adaugă hash
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs uppercase text-muted-foreground">Rapoarte ({items.length})</h3>
        {error ? (
          <ErrorBanner error={error} onRetry={load} />
        ) : loading ? (
          <LoadingBox />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">Niciun raport CSAM (empty legitim — apare doar la upload-uri marcate).</div>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-surface p-3">
                <div className="flex justify-between text-xs">
                  <span className="font-mono">{r.hash?.slice(0, 16)}…</span>
                  <span className="text-muted-foreground">{new Date(r.reported_at).toLocaleString("ro-RO")}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">user: {r.user_id?.slice(0, 8)} · sursa: {r.match_source ?? "?"} · {r.status}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   GDPR
========================================================= */
export function GdprPanel() {
  const getDel = useServerFn(adminGetDeletionRequests);
  const exportData = useServerFn(adminExportUserData);
  const processDel = useServerFn(adminProcessDeletion);
  const [items, setItems] = useState<any[]>([]);
  const [uid, setUid] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try { setItems(await getDel()); }
    catch (e: any) { const m = errMsg(e); setError(m); toast.error(m); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const doExport = async () => {
    if (!/^[0-9a-f-]{36}$/i.test(uid)) return toast.error("UUID invalid");
    const j = prompt("Justificare export (GDPR Art. 20):");
    if (!j || j.length < 5) return;
    try {
      const out = await exportData({ data: { userId: uid, justification: j } });
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `user-${uid.slice(0, 8)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Export descărcat");
    } catch (e: any) { toast.error(e.message); }
  };

  const process = async (id: string) => {
    if (!confirm("Hard-delete acest cont? Ireversibil!")) return;
    const j = prompt("Justificare (Art. 17):"); if (!j || j.length < 5) return;
    try { await processDel({ data: { requestId: id, justification: j } }); toast.success("Procesat"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Download className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">GDPR</h2>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-3">
        <h3 className="text-sm font-semibold">Export portabilitate (Art. 20)</h3>
        <div className="mt-2 flex gap-2">
          <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="user UUID"
            className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-mono" />
          <button onClick={doExport} className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">
            <Download className="mr-1 inline size-3" /> Export
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs uppercase text-muted-foreground">Cereri ștergere ({items.length})</h3>
        {error ? (
          <ErrorBanner error={error} onRetry={load} />
        ) : loading ? (
          <LoadingBox />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">Nicio cerere de ștergere (empty legitim).</div>
        ) : (
          <ul className="space-y-2">
            {items.map((d) => {
              const due = new Date(d.scheduled_for) <= new Date();
              return (
                <li key={d.id} className={`rounded-2xl border p-3 ${due ? "border-red-500/40 bg-red-500/5" : "border-border bg-surface"}`}>
                  <p className="text-xs">user: <span className="font-mono">{d.user_id.slice(0, 8)}</span> · status: {d.status}</p>
                  <p className="text-[10px] text-muted-foreground">cerut: {new Date(d.requested_at).toLocaleString("ro-RO")} · programat: {new Date(d.scheduled_for).toLocaleString("ro-RO")}</p>
                  {d.reason && <p className="mt-1 text-xs">"{d.reason}"</p>}
                  {d.status === "scheduled" && (
                    <button onClick={() => process(d.id)} className="mt-2 rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-500">
                      <Trash2 className="mr-1 inline size-3" /> Hard-delete acum
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   BREACH
========================================================= */
export function BreachPanel() {
  const get = useServerFn(adminGetBreaches);
  const create = useServerFn(adminCreateBreach);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [count, setCount] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try { setItems(await get()); }
    catch (e: any) { const m = errMsg(e); setError(m); toast.error(m); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (title.length < 3 || desc.length < 5) return toast.error("Date insuficiente");
    try {
      await create({ data: { title, description: desc, affected_users_count: Number(count) || undefined } });
      toast.success("Incident înregistrat — countdown 72h activ");
      setOpen(false); setTitle(""); setDesc(""); setCount(""); load();
    } catch (e: any) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertOctagon className="size-4 text-red-500" />
        <h2 className="text-lg font-semibold">Incidente de breșă</h2>
        <button onClick={() => setOpen(!open)} className="ml-auto rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-500">
          <Plus className="mr-1 inline size-3" /> Înregistrează
        </button>
      </div>
      {open && (
        <div className="space-y-2 rounded-2xl border border-red-500/30 bg-red-500/5 p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titlu" className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-xs" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descriere completă" rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs" />
          <input value={count} onChange={(e) => setCount(e.target.value)} placeholder="Nr. utilizatori afectați" type="number" className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-xs" />
          <button onClick={submit} className="w-full rounded-full bg-red-500/20 py-1.5 text-xs text-red-400">Salvează</button>
        </div>
      )}
      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : loading ? (
        <LoadingBox />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">Niciun incident înregistrat. ✅ (empty legitim)</div>
      ) : (
        <ul className="space-y-2">
          {items.map((b) => {
            const hoursLeft = Math.max(0, Math.round((new Date(b.notify_deadline).getTime() - Date.now()) / 3600 / 1000));
            return (
              <li key={b.id} className="rounded-2xl border border-border bg-surface p-3">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-semibold">{b.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${hoursLeft < 12 ? "bg-red-500/20 text-red-400" : "bg-orange-500/15 text-orange-500"}`}>
                    {hoursLeft}h rămase
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">afectați: {b.affected_users_count ?? "?"} · status: {b.status}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* =========================================================
   POLICIES
========================================================= */
export function PoliciesPanel() {
  const get = useServerFn(adminGetPolicies);
  const create = useServerFn(adminCreatePolicy);
  const [items, setItems] = useState<any[]>([]);
  const [kind, setKind] = useState<"terms" | "privacy" | "cookies" | "community">("terms");
  const [version, setVersion] = useState("");
  const [url, setUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try { setItems(await get()); }
    catch (e: any) { const m = errMsg(e); setError(m); toast.error(m); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!version) return toast.error("Versiune obligatorie");
    try { await create({ data: { kind, version, content_url: url || undefined } }); toast.success("Publicat"); setVersion(""); setUrl(""); load(); }
    catch (e: any) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><FileText className="size-4 text-primary" /><h2 className="text-lg font-semibold">Versiuni politici</h2></div>
      <div className="rounded-2xl border border-border bg-surface p-3">
        <div className="flex flex-wrap gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs">
            <option value="terms">Terms</option><option value="privacy">Privacy</option>
            <option value="cookies">Cookies</option><option value="community">Community</option>
          </select>
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex: 2026.06" className="rounded-full border border-border bg-background px-3 py-1.5 text-xs" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL conținut (opțional)" className="flex-1 min-w-[200px] rounded-full border border-border bg-background px-3 py-1.5 text-xs" />
          <button onClick={submit} className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">Publică</button>
        </div>
      </div>
      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : loading ? (
        <LoadingBox />
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-surface p-3 text-xs">
              <div className="flex justify-between">
                <span><strong>{p.kind}</strong> v{p.version}</span>
                <span className="text-muted-foreground">{new Date(p.effective_at).toLocaleString("ro-RO")}</span>
              </div>
              {p.content_url && <a href={p.content_url} target="_blank" rel="noopener noreferrer" className="text-primary">{p.content_url}</a>}
            </li>
          ))}
          {items.length === 0 && <li className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">Nicio versiune publicată (empty legitim).</li>}
        </ul>
      )}
    </div>
  );
}

/* =========================================================
   MFA SECURITY
========================================================= */
export function SecurityPanel() {
  const getMfa = useServerFn(adminGetMyMfa);
  const markMfa = useServerFn(adminMarkMfaEnrolled);
  const [status, setStatus] = useState<any>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => { getMfa().then(setStatus).catch(() => {}); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Ventuza Admin" });
      if (error) throw error;
      setQr(data.totp.qr_code); setSecret(data.totp.secret); setFactorId(data.id);
    } catch (e: any) { toast.error(e.message); setEnrolling(false); }
  };

  const verify = async () => {
    if (!factorId || code.length < 6) return;
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
      if (vErr) throw vErr;
      await markMfa({ data: { enrolled: true } });
      toast.success("MFA activat ✓");
      setEnrolling(false); setQr(null); setSecret(null); setFactorId(null); setCode("");
      getMfa().then(setStatus);
    } catch (e: any) { toast.error(e.message); }
  };

  const unenroll = async () => {
    if (!confirm("Dezactivezi MFA? Slăbește securitatea contului admin.")) return;
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
      await markMfa({ data: { enrolled: false } });
      toast.success("MFA dezactivat");
      getMfa().then(setStatus);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><h2 className="text-lg font-semibold">Securitate cont</h2></div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Autentificare cu 2 factori (TOTP)</p>
            <p className="text-xs text-muted-foreground">Folosește Google Authenticator, 1Password sau Authy.</p>
          </div>
          {status?.enrolled ? (
            <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs text-green-500">Activat ✓</span>
          ) : (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-500">Dezactivat</span>
          )}
        </div>
        {!enrolling && !status?.enrolled && (
          <button onClick={startEnroll} className="mt-3 w-full rounded-full bg-primary py-2 text-sm text-primary-foreground">Activează MFA</button>
        )}
        {status?.enrolled && !enrolling && (
          <button onClick={unenroll} className="mt-3 w-full rounded-full border border-border py-2 text-sm">Dezactivează</button>
        )}
        {enrolling && qr && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-center rounded-xl bg-white p-3">
              <img src={qr} alt="QR" className="size-44" />
            </div>
            {secret && <p className="text-center font-mono text-xs">{secret}</p>}
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="cod 6 cifre" inputMode="numeric"
              className="w-full rounded-full border border-border bg-background px-4 py-2 text-center text-lg font-mono tracking-widest" />
            <button onClick={verify} disabled={code.length !== 6} className="w-full rounded-full bg-primary py-2 text-sm text-primary-foreground disabled:opacity-50">
              Verifică & activează
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
