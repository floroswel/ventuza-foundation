import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, Gavel } from "lucide-react";
import { adminListAppeals, adminDecideAppeal } from "@/lib/admin-appeals.functions";
import { GlassCard, SectionTitle, StatusBadge } from "@/components/admin/ui/primitives";
import { ReasonDialog } from "@/components/admin/ReasonDialog";
import { Button } from "@/components/ui/button";

type Appeal = {
  id: string; user_id: string; kind: string; action_ref: string | null;
  original_reason: string | null; user_statement: string; evidence_urls: string[];
  status: string; decision_reason: string | null; created_at: string;
  profile: { display_name: string | null; banned_at: string | null; suspended_until: string | null } | null;
};

export function AppealsPanel() {
  const list = useServerFn(adminListAppeals);
  const decide = useServerFn(adminDecideAppeal);
  const [rows, setRows] = useState<Appeal[]>([]);
  const [status, setStatus] = useState<string>("open");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try { const r = await list({ data: { status: status as any, limit: 100 } }); setRows(r.rows as Appeal[]); }
    catch (e: any) { toast.error(e?.message ?? "Eroare"); } finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div className="space-y-4">
      <SectionTitle>Contestații (DSA Art. 20)</SectionTitle>
      <GlassCard>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
            {["open", "under_review", "granted", "denied", "withdrawn", "all"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={load} disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-primary/50">
            {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} Refresh
          </button>
        </div>

        {rows.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nicio contestație.</p>}
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id} className="rounded-xl border border-border/60 bg-surface-elevated p-3 text-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {a.profile?.display_name ?? "—"} · {a.kind}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("ro-RO")}
                    {a.action_ref && ` · ref: ${a.action_ref}`}
                  </p>
                </div>
                <StatusBadge tone={a.status === "granted" ? "approved" : a.status === "denied" ? "rejected" : "pending"}>
                  {a.status}
                </StatusBadge>
              </div>
              {a.original_reason && (
                <p className="mb-1 text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-wider">Motiv inițial:</span> {a.original_reason}
                </p>
              )}
              <p className="whitespace-pre-wrap rounded-md bg-background/50 p-2 text-xs">{a.user_statement}</p>
              {a.evidence_urls?.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11px]">
                  {a.evidence_urls.map((u, i) => (
                    <li key={i}><a href={u} target="_blank" rel="noreferrer" className="text-primary underline">Dovadă {i + 1}</a></li>
                  ))}
                </ul>
              )}
              {a.decision_reason && (
                <p className="mt-2 rounded-md border border-border/50 bg-background/40 p-2 text-[11px]">
                  <b>Decizie:</b> {a.decision_reason}
                </p>
              )}
              {(a.status === "open" || a.status === "under_review") && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ReasonDialog
                    title="Aprobă contestația"
                    description="Ridică sancțiunea și notifică userul."
                    confirmLabel="Aprobă"
                    minLen={20}
                    trigger={<Button size="sm" variant="default"><Gavel className="mr-1 size-3.5" />Aprobă</Button>}
                    onConfirm={async (reason) => {
                      await decide({ data: { appealId: a.id, decision: "granted", decisionReason: reason, autoLift: true } });
                      await load();
                    }}
                  />
                  <ReasonDialog
                    title="Respinge contestația"
                    description="Motivul e comunicat userului (DSA transparency)."
                    confirmLabel="Respinge"
                    destructive
                    minLen={20}
                    trigger={<Button size="sm" variant="outline">Respinge</Button>}
                    onConfirm={async (reason) => {
                      await decide({ data: { appealId: a.id, decision: "denied", decisionReason: reason, autoLift: false } });
                      await load();
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
