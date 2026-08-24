/**
 * Funnel web → instalare (Google Play / App Store): clickuri pe butoanele de
 * store, deschideri prin link universal (App Links / Universal Links),
 * deschideri prin intent Android și instalări confirmate (prima deschidere
 * nativă), defalcate pe sursă, variantă A/B și platformă.
 *
 * Include export CSV pe interval de date și alerte când conversia sau volumul
 * de evenimente scade sub pragurile din setările aplicației.
 *
 * Respectă patternul obligatoriu pentru panouri admin: loading / error /
 * empty legitim, distincte.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  source: string;
  variant: string;
  platform: string;
  clicks: number;
  app_link_opens: number;
  intent_opens: number;
  installs: number;
};

type ExportRow = Row & { day: string; os_name: string; browser: string };

type RawExportRow = {
  created_at: string;
  kind: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  variant: string;
  platform: string;
  os_name: string;
  browser: string;
  user_agent: string | null;
  referrer: string | null;
  referrer_url: string | null;
  path: string | null;
  app_installed: boolean | null;
};

function csvEscape(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function toRawCsv(rows: RawExportRow[]): string {
  const head = [
    "created_at",
    "kind",
    "source",
    "medium",
    "campaign",
    "variant",
    "platform",
    "os_name",
    "browser",
    "user_agent",
    "referrer",
    "referrer_url",
    "path",
    "app_installed",
  ];
  const body = rows.map((r) => head.map((k) => csvEscape((r as Record<string, unknown>)[k])).join(","));
  return [head.join(","), ...body].join("\n");
}

type Alert = {
  code: string;
  severity: string;
  message: string;
  observed: number;
  threshold: number;
};

function today(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function cvr(installs: number, clicks: number): string {
  if (!clicks) return "—";
  return `${((installs / clicks) * 100).toFixed(1)}%`;
}

function toCsv(rows: ExportRow[]): string {
  const head = [
    "day",
    "source",
    "variant",
    "platform",
    "os_name",
    "browser",
    "clicks",
    "app_link_opens",
    "intent_opens",
    "installs",
    "conversion_pct",
  ];
  const body = rows.map((r) => {
    const pct = Number(r.clicks) ? ((Number(r.installs) / Number(r.clicks)) * 100).toFixed(2) : "";
    return [
      r.day,
      r.source,
      r.variant,
      r.platform,
      r.os_name,
      r.browser,
      r.clicks,
      r.app_link_opens,
      r.intent_opens,
      r.installs,
      pct,
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",");
  });
  return [head.join(","), ...body].join("\n");
}

export function InstallFunnelPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [from, setFrom] = useState(today(30));
  const [to, setTo] = useState(today(0));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const describe = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    return /forbidden|denied|rol|role|policy|permission/i.test(msg)
      ? `Acces refuzat — necesită rol staff (admin/auditor). ${msg}`
      : msg;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summary, alertRes] = await Promise.all([
        supabase.rpc("admin_store_funnel_summary", { _days: days }),
        supabase.rpc("admin_store_funnel_alerts"),
      ]);
      if (summary.error) throw summary.error;
      if (alertRes.error) throw alertRes.error;
      setRows((summary.data ?? []) as Row[]);
      setAlerts((alertRes.data ?? []) as Alert[]);
    } catch (e) {
      setError(describe(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const { data, error: err } = await supabase.rpc("admin_store_funnel_export", {
        _from: from,
        _to: to,
      });
      if (err) throw err;
      const list = (data ?? []) as ExportRow[];
      if (!list.length) {
        setExportError("Empty legitim: niciun eveniment în intervalul selectat.");
        return;
      }
      const blob = new Blob([toCsv(list)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suzeta-install-funnel_${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(describe(e));
    } finally {
      setExporting(false);
    }
  }

  async function exportRawCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const { data, error: err } = await supabase.rpc("admin_store_funnel_export_raw", {
        _from: from,
        _to: to,
        _limit: 20000,
      });
      if (err) throw err;
      const list = (data ?? []) as RawExportRow[];
      if (!list.length) {
        setExportError("Empty legitim: niciun eveniment în intervalul selectat.");
        return;
      }
      const blob = new Blob([toRawCsv(list)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suzeta-install-funnel-detaliat_${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(describe(e));
    } finally {
      setExporting(false);
    }
  }

  const total = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + Number(r.clicks || 0),
      app_link_opens: acc.app_link_opens + Number(r.app_link_opens || 0),
      intent_opens: acc.intent_opens + Number(r.intent_opens || 0),
      installs: acc.installs + Number(r.installs || 0),
    }),
    { clicks: 0, app_link_opens: 0, intent_opens: 0, installs: 0 },
  );

  const byVariant = new Map<string, { clicks: number; installs: number }>();
  for (const r of rows) {
    const cur = byVariant.get(r.variant) ?? { clicks: 0, installs: 0 };
    cur.clicks += Number(r.clicks || 0);
    cur.installs += Number(r.installs || 0);
    byVariant.set(r.variant, cur);
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Funnel instalări (store)</h2>
          <p className="text-xs text-muted-foreground">
            Evenimente anonime (fără user, fără IP): click pe magazin, deschidere prin link
            universal, deschidere prin intent Android, prima deschidere după instalare.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
          >
            <option value={7}>7 zile</option>
            <option value={30}>30 zile</option>
            <option value={90}>90 zile</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="h-9 rounded-lg border border-border px-3 text-xs font-medium"
          >
            Reîncarcă
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Eroare la încărcare</p>
          <p className="mt-1 break-words text-xs">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 h-8 rounded-lg border border-destructive/40 px-3 text-xs font-medium"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {loading && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Se încarcă…
        </div>
      )}

      {!loading && !error && (
        <>
          {alerts.length > 0 ? (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.code}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                    a.severity === "critical"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-600"
                  }`}
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {a.message}{" "}
                    <span className="opacity-70">
                      (observat {Number(a.observed)} · prag {Number(a.threshold)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600">
              Nicio alertă: volumul de evenimente și conversia sunt peste praguri. Pragurile se
              editează în Setări → cheia <code>store_funnel_alerts</code>.
            </p>
          )}

          <div className="rounded-xl border border-border bg-surface/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Export CSV pe interval
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
              />
              <button
                type="button"
                disabled={exporting}
                onClick={() => void exportCsv()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {exporting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Descarcă CSV (agregat)
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={() => void exportRawCsv()}
                title="Un rând per eveniment: referrer brut, user agent, OS și browser"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                {exporting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                CSV detaliat (referrer/UA/OS)
              </button>
            </div>

            {exportError && (
              <p className="mt-2 break-words text-xs text-destructive">{exportError}</p>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface/40 p-4 text-sm text-muted-foreground">
              Empty legitim: nicio interacțiune înregistrată în perioada selectată.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {([
                  ["Clickuri store", total.clicks],
                  ["Deschideri link universal", total.app_link_opens],
                  ["Deschideri intent", total.intent_opens],
                  ["Instalări", total.installs],
                ] as Array<[string, number]>).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border bg-surface/40 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-border bg-surface/40 p-3">
                  <p className="text-xs text-muted-foreground">Rată conversie</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {cvr(total.installs, total.clicks)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Test A/B CTA (play_badge = „Get it on Google Play”, open_app = „Deschide în
                  aplicație”)
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[...byVariant.entries()].map(([variant, v]) => (
                    <li
                      key={variant}
                      className="flex items-center justify-between rounded-lg bg-surface/40 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">{variant}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.clicks} clickuri · {v.installs} instalări · {cvr(v.installs, v.clicks)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Sursă</th>
                      <th className="px-3 py-2 text-left">Variantă</th>
                      <th className="px-3 py-2 text-left">Platformă</th>
                      <th className="px-3 py-2 text-right">Clickuri</th>
                      <th className="px-3 py-2 text-right">App link</th>
                      <th className="px-3 py-2 text-right">Intent</th>
                      <th className="px-3 py-2 text-right">Instalări</th>
                      <th className="px-3 py-2 text-right">Conversie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={`${r.source}|${r.variant}|${r.platform}`}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">{r.source}</td>
                        <td className="px-3 py-2">{r.variant}</td>
                        <td className="px-3 py-2">{r.platform}</td>
                        <td className="px-3 py-2 text-right">{Number(r.clicks)}</td>
                        <td className="px-3 py-2 text-right">{Number(r.app_link_opens)}</td>
                        <td className="px-3 py-2 text-right">{Number(r.intent_opens)}</td>
                        <td className="px-3 py-2 text-right">{Number(r.installs)}</td>
                        <td className="px-3 py-2 text-right">
                          {cvr(Number(r.installs), Number(r.clicks))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
