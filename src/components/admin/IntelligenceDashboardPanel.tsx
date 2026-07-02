import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { GlassCard, Kpi, MonoNumber, SectionTitle } from "@/components/admin/ui/primitives";
import {
  getRevenueStats,
  getRetentionCohorts,
  getFunnelStats,
} from "@/lib/admin-intelligence.functions";

export function IntelligenceDashboardPanel() {
  const rev = useServerFn(getRevenueStats);
  const coh = useServerFn(getRetentionCohorts);
  const fun = useServerFn(getFunnelStats);
  const [revenue, setRevenue] = useState<any>(null);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      const [r, c, f] = await Promise.all([
        rev(),
        coh({ data: { days: 30 } }),
        fun({ data: { days: 30 } }),
      ]);
      setRevenue(r);
      setCohorts(c as any[]);
      setFunnel(f);
    } catch (e: any) {
      setErr(e?.message ?? "Eroare");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  if (busy) return <Loader2 className="mx-auto mt-12 size-6 animate-spin" />;
  if (err)
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-300">
        {err}
      </div>
    );

  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <button
            onClick={load}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] hover:border-primary/50"
          >
            <RefreshCw className="size-3" /> Refresh
          </button>
        }
      >
        <TrendingUp className="mr-1 inline size-4" />
        Business intelligence
      </SectionTitle>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="MRR (RON)" value={revenue?.mrr_ron ?? "—"} tone="success" />
        <Kpi label="ARR (RON)" value={revenue?.arr_ron ?? "—"} tone="success" />
        <Kpi label="Abonamente active" value={revenue?.active_subs ?? "—"} />
        <Kpi label="ARPU (RON)" value={revenue?.arpu_ron ?? "—"} />
        <Kpi label="Trial → paid 30d" value={revenue?.trial_to_paid_30d ?? "—"} />
        <Kpi
          label="Churn 30d (%)"
          value={revenue?.churn_30d ?? "—"}
          tone={(revenue?.churn_30d ?? 0) > 5 ? "warn" : "default"}
        />
        <Kpi label="Signups 30d" value={funnel?.signup ?? "—"} />
        <Kpi label="First msg 30d" value={funnel?.first_message ?? "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle>Retenție (cohorte D1/D7/D30)</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">Cohortă</th>
                  <th>N</th>
                  <th>D1</th>
                  <th>D7</th>
                  <th>D30</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground">
                      Fără date.
                    </td>
                  </tr>
                )}
                {cohorts.map((c: any) => (
                  <tr key={c.cohort_date} className="border-t border-border/50">
                    <td className="px-2 py-1">
                      {new Date(c.cohort_date).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <MonoNumber value={c.cohort_size} />
                    </td>
                    <td className="px-2 py-1 text-center">{c.d1_pct ?? 0}%</td>
                    <td className="px-2 py-1 text-center">{c.d7_pct ?? 0}%</td>
                    <td className="px-2 py-1 text-center">{c.d30_pct ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle>Funnel core (30 zile)</SectionTitle>
          {funnel ? (
            <ul className="space-y-2 text-sm">
              {[
                ["Signup", funnel.signup],
                ["Profil complet", funnel.profile_complete],
                ["Prima poză", funnel.first_photo],
                ["Primul swipe", funnel.first_swipe],
                ["Primul match", funnel.first_match],
                ["Primul mesaj", funnel.first_message],
              ].map(([k, v], i, arr) => {
                const base = Number(arr[0][1]) || 1;
                const pct = Math.round((Number(v) * 100) / base);
                return (
                  <li key={k as string}>
                    <div className="flex justify-between text-xs">
                      <span>{k as string}</span>
                      <span className="admin-mono">
                        {Number(v).toLocaleString("ro-RO")} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-surface-elevated">
                      <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Fără date.</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
