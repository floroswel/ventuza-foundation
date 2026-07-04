import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldCheck, Eye, Check, X, HelpCircle } from "lucide-react";
import { GlassCard, Kpi, SectionTitle, StatusBadge } from "@/components/admin/ui/primitives";
import {
  adminListVerificationRequests,
  adminVerificationStats,
  adminClaimVerification,
  adminTakeVerification,
  adminVerificationSignedUrls,
  adminDecideVerification,
} from "@/lib/admin-verification.functions";

type Row = {
  id: string;
  user_id: string;
  display_name: string | null;
  status: string;
  method: string | null;
  version: number | null;
  submitted_at: string;
  decided_at: string | null;
  decision: string | null;
  reason: string | null;
  moderator_id: string | null;
  needs_second: boolean | null;
  retention_until: string;
  country: string | null;
};

const STATUS_TABS = [
  { id: "pending", label: "În așteptare" },
  { id: "in_review", label: "În analiză" },
  { id: "needs_second", label: "A doua părere" },
  { id: "approved", label: "Aprobate" },
  { id: "rejected", label: "Respinse" },
  { id: "appeal", label: "Contestații" },
  { id: "expired", label: "Expirate" },
] as const;

export function VerificationQueuePanel() {
  const listFn = useServerFn(adminListVerificationRequests);
  const statsFn = useServerFn(adminVerificationStats);
  const claimFn = useServerFn(adminClaimVerification);
  const takeFn = useServerFn(adminTakeVerification);
  const urlsFn = useServerFn(adminVerificationSignedUrls);
  const decideFn = useServerFn(adminDecideVerification);

  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [imgs, setImgs] = useState<any[]>([]);
  const [loadingImgs, setLoadingImgs] = useState(false);
  const [reasonCode, setReasonCode] = useState("other");
  const [reason, setReason] = useState("");
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">("medium");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [l, s] = await Promise.all([
        listFn({ data: { status, limit: 100 } }),
        statsFn(),
      ]);
      setRows((l as any).rows ?? []);
      setStats(s);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openReq = async (id: string) => {
    setOpenId(id);
    setImgs([]);
    setLoadingImgs(true);
    setReason("");
    setReasonCode("other");
    setConfidence("medium");
    try {
      // Auto-claim (owner sau second reviewer) — necesar ca decide-ul să nu dea `not_your_claim`.
      await takeFn({ data: { requestId: id } });
      const r = await urlsFn({ data: { requestId: id } });
      setImgs((r as any).images ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut încărca cererea");
    } finally {
      setLoadingImgs(false);
    }
  };

  const claim = async () => {
    setBusy(true);
    try {
      const r = await claimFn();
      const req = (r as any).request;
      if (!req) {
        toast.info("Coada este goală.");
        await load();
        return;
      }
      toast.success("Cerere claimed");
      await load();
      setOpenId(req.request_id);
      await openReq(req.request_id);
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: "approve" | "reject" | "needs_second" | "appeal_required") => {
    if (!openId) return;
    if (reason.trim().length < 3) {
      toast.error("Adaugă un motiv (min. 3 caractere).");
      return;
    }
    setBusy(true);
    try {
      await decideFn({
        data: {
          requestId: openId,
          decision,
          reasonCode: reasonCode || decision,
          reason: reason.trim(),
          confidence,
        },
      });
      toast.success(`Decizie: ${decision}`);
      setOpenId(null);
      setImgs([]);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare la salvare decizie");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !stats)
    return <Loader2 className="mx-auto mt-12 size-6 animate-spin" />;

  const c = stats?.counts ?? {};

  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={claim}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] hover:bg-primary/20 disabled:opacity-50"
            >
              <ShieldCheck className="size-3" /> Preia următoarea cerere
            </button>
            <button
              onClick={load}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] hover:border-primary/50"
            >
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>
        }
      >
        <ShieldCheck className="mr-1 inline size-4" />
        Verificare identitate — coadă moderare
      </SectionTitle>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi label="Pending" value={c.pending ?? 0} tone={(c.pending ?? 0) > 0 ? "warn" : "default"} />
        <Kpi label="În analiză" value={c.in_review ?? 0} />
        <Kpi label="A 2-a părere" value={c.needs_second ?? 0} />
        <Kpi label="Aprobate 7d" value={stats?.approved_7d ?? 0} tone="success" />
        <Kpi label="Respinse 7d" value={stats?.rejected_7d ?? 0} />
        <Kpi label="Contestații" value={c.appeal ?? 0} />
        <Kpi label="Expirate" value={c.expired ?? 0} />
      </div>

      <GlassCard>
        <p className="text-[11px] text-muted-foreground">
          <b>Retenție:</b> {stats?.retention_days ?? 30} zile de la depunere. După acest termen,
          imaginile sunt marcate <code>deleted_at</code> și șterse din bucket-ul privat{" "}
          <code>verification</code> printr-un job service-role. Cererile în{" "}
          <b>pending / rejected / appeal</b> trec în <b>expired</b>. Imaginile se accesează DOAR
          prin URL semnat de 30 secunde generat aici; fiecare vizualizare este auditată în{" "}
          <code>admin_sensitive_access_log</code>.
        </p>
      </GlassCard>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setStatus(t.id)}
            className={`rounded-full border px-3 py-1 text-[11px] ${
              status === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/40"
            }`}
          >
            {t.label} {c[t.id] != null ? `· ${c[t.id]}` : ""}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <Loader2 className="mx-auto mt-6 size-5 animate-spin" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Nicio cerere în această stare.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface-elevated text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">User</th>
                <th className="px-2 py-1.5 text-left">Depusă</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-left">Decizie</th>
                <th className="px-2 py-1.5 text-left">Motiv</th>
                <th className="px-2 py-1.5 text-left">Expiră</th>
                <th className="px-2 py-1.5 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50 hover:bg-surface-elevated/40">
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{r.display_name ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.user_id.slice(0, 8)}…
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    {new Date(r.submitted_at).toLocaleString("ro-RO")}
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusBadge>{r.status}</StatusBadge>
                  </td>
                  <td className="px-2 py-1.5">{r.decision ?? "—"}</td>
                  <td className="px-2 py-1.5 max-w-[220px] truncate" title={r.reason ?? ""}>
                    {r.reason ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {new Date(r.retention_until).toLocaleDateString("ro-RO")}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => openReq(r.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] hover:border-primary/50"
                    >
                      <Eye className="size-3" /> Vezi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <SectionTitle>Cerere #{openId.slice(0, 8)}…</SectionTitle>
              <button
                onClick={() => {
                  setOpenId(null);
                  setImgs([]);
                }}
                className="rounded-full border border-border px-2 py-1 text-[10px]"
              >
                Închide
              </button>
            </div>

            {loadingImgs ? (
              <Loader2 className="mx-auto my-6 size-5 animate-spin" />
            ) : imgs.length === 0 ? (
              <p className="my-6 text-center text-xs text-muted-foreground">
                Nicio imagine (posibil purgată deja).
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {imgs.map((im) => (
                  <div key={im.id} className="rounded-xl border border-border overflow-hidden">
                    {im.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={im.url}
                        alt={im.challenge_code}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-square w-full bg-surface-elevated" />
                    )}
                    <div className="p-1.5 text-[10px]">
                      <div className="font-medium">{im.challenge_code}</div>
                      <div className="text-muted-foreground">
                        {new Date(im.captured_at).toLocaleTimeString("ro-RO")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px]">
                  <span className="mb-0.5 block text-muted-foreground">Reason code</span>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs"
                  >
                    <option value="other">other (aprobare / general)</option>
                    <option value="low_quality">low_quality</option>
                    <option value="face_not_visible">face_not_visible</option>
                    <option value="multiple_people">multiple_people</option>
                    <option value="suspected_fake">suspected_fake</option>
                    <option value="underage_suspicion">underage_suspicion</option>
                    <option value="replay_attack">replay_attack</option>
                    <option value="deepfake_suspicion">deepfake_suspicion</option>
                  </select>
                </label>
                <label className="text-[11px]">
                  <span className="mb-0.5 block text-muted-foreground">Confidence</span>
                  <select
                    value={confidence}
                    onChange={(e) => setConfidence(e.target.value as any)}
                    className="w-full rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>
              </div>
              <label className="block text-[11px]">
                <span className="mb-0.5 block text-muted-foreground">Motiv (obligatoriu)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs"
                  placeholder="Ex: gest corect, față vizibilă, potrivire clară cu poza de profil."
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => decide("approve")}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-[11px] text-green-300 hover:bg-green-500/20 disabled:opacity-50"
                >
                  <Check className="size-3" /> Aprobă
                </button>
                <button
                  onClick={() => decide("reject")}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[11px] text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <X className="size-3" /> Respinge
                </button>
                <button
                  onClick={() => decide("needs_second")}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-[11px] text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-50"
                >
                  <HelpCircle className="size-3" /> A doua părere
                </button>
                <button
                  onClick={() => decide("appeal_required")}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] hover:border-primary/50 disabled:opacity-50"
                >
                  Escaladează contestație
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
