/**
 * PushHealthPanel — sănătatea canalului push (FCM/APNS/Web Push).
 * Sursă: `push_subscriptions` + `notifications`. Fără PII (endpoint/auth/p256dh
 * rămân în SENSITIVE_COLUMNS și nu sunt niciodată proiectate aici).
 */
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { getPushHealth } from "@/lib/admin-intelligence.functions";
import { PanelStatus, useAdminPanelLoad, LastCheckBadge } from "@/components/admin/PanelStatus";

type PushHealth = Awaited<ReturnType<typeof getPushHealth>>;

export function PushHealthPanel() {
  const fn = useServerFn(getPushHealth);
  const [state, reload, at] = useAdminPanelLoad<PushHealth>(async () => fn(), [], {
    autoRefreshMs: 60_000,
  });
  const data = state.status === "ready" ? state.data : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Push delivery (FCM/APNS/Web)</h3>
        <div className="ml-auto"><LastCheckBadge at={at} /></div>
      </div>
      <PanelStatus state={state} retry={reload} isEmpty={!!data && data.totals.subscriptions === 0}
        emptyHint="Nicio subscription push înregistrată.">
        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Total subs" value={data.totals.subscriptions} />
              <Stat label="Active 7d" value={data.totals.active_7d} />
              <Stat label="Active 30d" value={data.totals.active_30d} />
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Per platformă</h4>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1">Platform</th><th>Total</th><th>Active 7d</th><th>Active 30d</th><th>Kinds</th></tr>
                </thead>
                <tbody>
                  {data.platforms.map((p) => (
                    <tr key={p.platform} className="border-t border-border/50">
                      <td className="py-2 font-mono text-xs">{p.platform}</td>
                      <td>{p.total}</td>
                      <td>{p.active7}</td>
                      <td>{p.active30}</td>
                      <td className="text-xs text-muted-foreground">
                        {Object.entries(p.kinds).map(([k, n]) => `${k}:${n}`).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notificări 7d (sent → read)</h4>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1">Tip</th><th>Sent</th><th>Read</th><th>Read rate</th></tr>
                </thead>
                <tbody>
                  {data.notifications_7d.length === 0 && (
                    <tr><td colSpan={4} className="py-2 text-xs text-muted-foreground">Nicio notificare în ultimele 7 zile.</td></tr>
                  )}
                  {data.notifications_7d.map((n) => (
                    <tr key={n.kind} className="border-t border-border/50">
                      <td className="py-2 font-mono text-xs">{n.kind}</td>
                      <td>{n.sent}</td>
                      <td>{n.read}</td>
                      <td className={n.read_rate >= 0.3 ? "text-emerald-400" : "text-muted-foreground"}>
                        {(n.read_rate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PanelStatus>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString("ro-RO")}</p>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
