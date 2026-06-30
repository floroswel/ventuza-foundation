import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  X, ShieldAlert, AlertTriangle, BadgeCheck, Flag, Activity, RefreshCw,
  Copy, ExternalLink, Clock, FileText, ChevronRight,
} from "lucide-react";
import { adminGetUserRiskDetail, type UserRiskDetail } from "@/lib/risk-queue.functions";
import { toast } from "sonner";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ro-RO", { year: "numeric", month: "short", day: "2-digit" });
}
function scoreTone(s: number) {
  if (s >= 80) return "bg-red-500/20 text-red-300 border-red-500/40";
  if (s >= 60) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (s >= 40) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
}
function sevDot(sev: number) {
  if (sev >= 80) return "bg-red-500";
  if (sev >= 60) return "bg-amber-500";
  if (sev >= 40) return "bg-yellow-500";
  return "bg-emerald-500";
}

export function UserRiskDetailDialog({
  userId, onClose,
}: { userId: string | null; onClose: () => void }) {
  const fetchDetail = useServerFn(adminGetUserRiskDetail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserRiskDetail | null>(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true); setError(null);
    try {
      const r = (await fetchDetail({ data: { userId } })) as UserRiskDetail;
      setDetail(r);
    } catch (e: any) {
      setError(e?.message ?? "Eroare la încărcare.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!userId) return null;

  const p = detail?.profile;
  const flags = detail?.flags ?? [];
  const signals = (p?.risk_signals as Record<string, any> | null) ?? null;
  const breakdown: Array<[string, number]> = signals && typeof signals === "object"
    ? Object.entries(signals)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => [k, v as number])
        .sort((a, b) => b[1] - a[1])
    : [];

  const copy = async (s: string) => {
    try { await navigator.clipboard.writeText(s); toast.success("Copiat"); }
    catch { toast.error("Nu am putut copia"); }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border bg-surface/60 p-4">
          <ShieldAlert className="mt-0.5 size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold">
                {p?.display_name ?? "(fără nume)"}
              </h3>
              {p?.age_status === "verified" && <BadgeCheck className="size-4 text-primary" />}
              {p?.banned_at && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">banat</span>}
              {p?.suspended_until && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">suspendat</span>}
              {p?.partner_suspended_at && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">partner suspendat</span>}
            </div>
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <span className="truncate">{userId}</span>
              <button onClick={() => copy(userId)} title="Copiază ID" className="rounded-md border border-border p-0.5 hover:text-foreground">
                <Copy className="size-3" />
              </button>
              {p?.profile_slug && (
                <a
                  href={`/u/${p.profile_slug}`}
                  target="_blank" rel="noreferrer"
                  title="Deschide profil public"
                  className="rounded-md border border-border p-0.5 hover:text-foreground"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
          <button onClick={load} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground" title="Reîncarcă">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onClose} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground" title="Închide">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-72px)] space-y-4 overflow-y-auto p-4">
          {loading && <div className="py-8 text-center text-sm text-muted-foreground">Se încarcă…</div>}
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
              <button onClick={load} className="ml-2 rounded-full border border-red-500/40 px-2 py-0.5 text-xs">Reîncearcă</button>
            </div>
          )}

          {!loading && !error && detail && p && (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Kpi label="Scor curent" value={
                  <span className={`rounded border px-2 py-0.5 text-base ${scoreTone(p.risk_score ?? 0)}`}>
                    {p.risk_score ?? 0}
                  </span>
                } />
                <Kpi label="Flag-uri totale" value={flags.length} icon={<Flag className="size-3" />} />
                <Kpi label="Rapoarte primite" value={detail.reports_received} icon={<AlertTriangle className="size-3" />} />
                <Kpi label="Cont creat" value={fmtDate(p.created_at)} icon={<Clock className="size-3" />} />
              </div>

              {/* Risk score breakdown */}
              <Section title="Compoziție scor (snapshot curent)" icon={<Activity className="size-4" />}>
                <div className="mb-2 text-[11px] text-muted-foreground">
                  Ultimul recalc: {fmt(p.risk_updated_at)}
                </div>
                {breakdown.length === 0 ? (
                  <div className="py-2 text-xs text-muted-foreground">Niciun semnal numeric înregistrat încă.</div>
                ) : (
                  <div className="space-y-1.5">
                    {breakdown.map(([k, v]) => {
                      const max = Math.max(...breakdown.map(([, n]) => Math.abs(n)), 1);
                      const pct = Math.min(100, Math.round((Math.abs(v) / max) * 100));
                      const positive = v >= 0;
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <div className="w-40 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k}</div>
                          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-surface">
                            <div
                              className={`h-full ${positive ? "bg-amber-500/70" : "bg-emerald-500/70"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className={`w-12 text-right font-mono text-xs ${positive ? "text-amber-300" : "text-emerald-300"}`}>
                            {positive ? "+" : ""}{v}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Timeline */}
              <Section
                title={`Timeline risk_flags (${flags.length})`}
                icon={<Flag className="size-4" />}
              >
                {flags.length === 0 ? (
                  <div className="py-3 text-center text-xs text-muted-foreground">Niciun flag înregistrat.</div>
                ) : (
                  <ol className="relative ml-2 space-y-3 border-l border-border/60 pl-4">
                    {flags.map((f) => (
                      <li key={f.id} className="relative">
                        <span className={`absolute -left-[21px] mt-1.5 inline-block size-3 rounded-full ring-2 ring-background ${sevDot(f.severity)}`} />
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide">
                            {f.kind}
                          </span>
                          <span className={`rounded border px-1.5 py-0 text-[10px] ${scoreTone(f.severity)}`}>
                            sev {f.severity}
                          </span>
                          {f.status === "open" ? (
                            <span className="text-amber-300">open</span>
                          ) : (
                            <span className="text-muted-foreground">{f.status}</span>
                          )}
                          <span className="ml-auto text-[11px] text-muted-foreground">{fmt(f.created_at)}</span>
                        </div>
                        {f.resolved_at && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            Rezolvat: {fmt(f.resolved_at)}
                          </div>
                        )}
                        {f.details && Object.keys(f.details).length > 0 && (
                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-surface/60 p-2 text-[10px] text-muted-foreground">
                            {JSON.stringify(f.details, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </Section>

              {/* Audit log */}
              {detail.audit.length > 0 && (
                <Section title="Acțiuni admin pe acest user" icon={<FileText className="size-4" />}>
                  <ul className="space-y-1.5">
                    {detail.audit.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-xs">
                        <ChevronRight className="size-3 text-muted-foreground" />
                        <span className="font-mono">{a.action}</span>
                        {a.severity && (
                          <span className={`rounded px-1.5 py-0 text-[10px] ${
                            a.severity === "critical" ? "bg-red-500/20 text-red-300" :
                            a.severity === "warning" ? "bg-amber-500/20 text-amber-300" :
                            "bg-muted text-muted-foreground"
                          }`}>{a.severity}</span>
                        )}
                        <span className="text-muted-foreground">{a.actor_email ?? "—"}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">{fmt(a.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <div className="text-[10px] text-muted-foreground">
                Rapoarte trimise de acest user: {detail.reports_made}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 truncate text-base font-semibold">{value}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
      {children}
    </div>
  );
}
