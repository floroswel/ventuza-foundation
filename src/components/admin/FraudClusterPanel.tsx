/**
 * FraudClusterPanel — cluster-uri device fingerprint care apar pe >1 user
 * (semnal multi-account). Fingerprint-ul e MASCAT (primele 8 caractere din
 * hash), conform SENSITIVE_COLUMNS.device_fingerprints. Doar `admin`+.
 */
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, Link as LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getFraudClusters } from "@/lib/admin-intelligence.functions";
import { PanelStatus, useAdminPanelLoad, LastCheckBadge } from "@/components/admin/PanelStatus";

type Data = Awaited<ReturnType<typeof getFraudClusters>>;

export function FraudClusterPanel() {
  const fn = useServerFn(getFraudClusters);
  const [state, reload, at] = useAdminPanelLoad<Data>(
    async () => fn({ data: { min_users: 2, days: 60 } }),
    [],
    { autoRefreshMs: 120_000 },
  );
  const data = state.status === "ready" ? state.data : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold">Anti-fraud — cluster device (multi-account)</h3>
        <div className="ml-auto"><LastCheckBadge at={at} /></div>
      </div>
      <PanelStatus state={state} retry={reload} isEmpty={!!data && data.cluster_count === 0}
        emptyHint="Niciun cluster suspect (≥2 useri pe același device).">
        {data && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {data.cluster_count} cluster{data.cluster_count === 1 ? "" : "e"} din{" "}
              <span className="font-mono">{data.total_fingerprints}</span> fingerprint-uri analizate (60 zile).
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-1">FP hash</th><th>Useri</th><th>Ultimul văzut</th><th>Acțiuni</th></tr>
              </thead>
              <tbody>
                {data.clusters.map((c) => (
                  <tr key={c.fp_hash} className="border-t border-border/50">
                    <td className="py-2 font-mono text-xs">{c.fp_hash}…</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${c.users_count >= 5 ? "bg-red-500/15 text-red-300" : c.users_count >= 3 ? "bg-amber-500/15 text-amber-300" : "bg-muted text-muted-foreground"}`}>
                        {c.users_count}
                      </span>
                    </td>
                    <td className="text-xs font-mono">{c.last_seen?.slice(0, 16) ?? "—"}</td>
                    <td className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {c.user_ids.slice(0, 5).map((uid) => (
                          <Link key={uid} to="/admin/users/$id" params={{ id: uid }}
                            className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted">
                            <LinkIcon className="size-2.5" />
                            {uid.slice(0, 6)}
                          </Link>
                        ))}
                        {c.users_count > 5 && (
                          <span className="text-[10px] text-muted-foreground">+{c.users_count - 5}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-muted-foreground">
              Notă: cluster-ele mari nu implică automat fraudă (familie, dispozitive partajate).
              Investighează în User 360 înainte de acțiuni distructive.
            </p>
          </div>
        )}
      </PanelStatus>
    </section>
  );
}
