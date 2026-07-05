/**
 * PartnerBoostCalendarPanel — calendar simplu (zi × oraș) al slot-urilor
 * boost active. Sursă: `partner_boost_orders` + JOIN `events(title, city)`.
 */
import { useServerFn } from "@tanstack/react-start";
import { Rocket } from "lucide-react";
import { getPartnerBoostCalendar } from "@/lib/admin-intelligence.functions";
import { PanelStatus, useAdminPanelLoad, LastCheckBadge } from "@/components/admin/PanelStatus";

type Calendar = Awaited<ReturnType<typeof getPartnerBoostCalendar>>;

export function PartnerBoostCalendarPanel() {
  const fn = useServerFn(getPartnerBoostCalendar);
  const [state, reload, at] = useAdminPanelLoad<Calendar>(
    async () => fn({ data: { days_ahead: 30, days_back: 3 } }),
    [],
    { autoRefreshMs: 90_000 },
  );
  const data = state.status === "ready" ? state.data : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Rocket className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Calendar boost partener (30 zile)</h3>
        <div className="ml-auto"><LastCheckBadge at={at} /></div>
      </div>
      <PanelStatus state={state} retry={reload} isEmpty={!!data && data.orders.length === 0}
        emptyHint="Niciun boost în fereastra selectată.">
        {data && (
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Densitate per zi</h4>
              <div className="flex flex-wrap gap-1">
                {data.by_day.map((d) => (
                  <span key={d.day} className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs">
                    <span className="font-mono text-muted-foreground">{d.day.slice(5)}</span>
                    <span className="ml-1 font-semibold">×{d.count}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Per oraș</h4>
              <div className="flex flex-wrap gap-2">
                {data.by_city.map((c) => (
                  <span key={c.city} className={`rounded-full px-2.5 py-1 text-xs ${c.count >= 3 ? "bg-amber-500/15 text-amber-300" : "bg-muted text-muted-foreground"}`}>
                    {c.city} · {c.count}
                  </span>
                ))}
              </div>
              {data.by_city.some((c) => c.count >= 3) && (
                <p className="mt-2 text-[11px] text-amber-300/80">Atenție: 3+ boost-uri pe același oraș pot suprapune inventory-ul.</p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ordine (top 20)</h4>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1">Eveniment</th><th>Oraș</th><th>Start</th><th>Sfârșit</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.orders.slice(0, 20).map((o) => (
                    <tr key={o.id} className="border-t border-border/50">
                      <td className="py-1.5 pr-2 truncate max-w-[180px]">{o.event_title}{o.is_seed && <span className="ml-1 text-[10px] text-muted-foreground">seed</span>}</td>
                      <td className="text-xs">{o.city ?? "—"}</td>
                      <td className="text-xs font-mono">{o.starts_at?.slice(5, 16) ?? "—"}</td>
                      <td className="text-xs font-mono">{o.ends_at?.slice(5, 16) ?? "—"}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${o.active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {o.active ? "activ" : "inactiv"}
                        </span>
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
