/**
 * Funnel web → instalare Google Play: câte clickuri pe butoanele de store,
 * câte deschideri directe în aplicație (intent) și câte instalări confirmate
 * (prima deschidere a aplicației native), grupate pe sursă / UTM.
 *
 * Respectă patternul obligatoriu pentru panouri admin: loading / error /
 * empty legitim, distincte.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  source: string;
  clicks: number;
  app_opens: number;
  installs: number;
};

export function InstallFunnelPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("admin_store_funnel_summary", {
        _days: days,
      });
      if (err) throw err;
      setRows((data ?? []) as Row[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const denied = /forbidden|denied|rol|role|policy|permission/i.test(msg);
      setError(denied ? `Acces refuzat — necesită rol staff (admin/auditor). ${msg}` : msg);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + Number(r.clicks || 0),
      app_opens: acc.app_opens + Number(r.app_opens || 0),
      installs: acc.installs + Number(r.installs || 0),
    }),
    { clicks: 0, app_opens: 0, installs: 0 },
  );
  const cvr = total.clicks ? (total.installs / total.clicks) * 100 : 0;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Funnel instalări (Google Play)</h2>
          <p className="text-xs text-muted-foreground">
            Evenimente anonime (fără user, fără IP): click pe store, deschidere în aplicație,
            prima deschidere după instalare.
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

      {!loading && !error && rows.length === 0 && (
        <p className="rounded-xl border border-border bg-surface/40 p-4 text-sm text-muted-foreground">
          Empty legitim: nicio interacțiune înregistrată în perioada selectată.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Clickuri store", total.clicks],
              ["Deschideri în app", total.app_opens],
              ["Instalări (prima deschidere)", total.installs],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-surface/40 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{Number(value)}</p>
              </div>
            ))}
            <div className="rounded-xl border border-border bg-surface/40 p-3">
              <p className="text-xs text-muted-foreground">Rată conversie</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{cvr.toFixed(1)}%</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Sursă (utm_source)</th>
                  <th className="px-3 py-2 text-right">Clickuri</th>
                  <th className="px-3 py-2 text-right">Deschideri app</th>
                  <th className="px-3 py-2 text-right">Instalări</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.source} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{r.source}</td>
                    <td className="px-3 py-2 text-right">{Number(r.clicks)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.app_opens)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.installs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
