/**
 * Dashboard intern de performanță: TTFR / TTI / web-vitals corelate cu
 * versiunea de build, ca să vedem imediat ce release a îmbunătățit (sau
 * stricat) pornirea aplicației.
 *
 * Respectă patternul obligatoriu pentru panouri admin: loading / error /
 * empty legitim, distincte.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  metric: string;
  value: number;
  app_version: string | null;
  platform: string | null;
  created_at: string;
};

type ErrRow = {
  id: number;
  created_at: string;
  kind: string;
  message: string;
  path: string | null;
  app_version: string | null;
  platform: string | null;
};

const TRACKED = ["app_first_render", "app_boot_data", "app_interactive", "LCP", "INP", "CLS"];

function p(values: number[], q: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.floor((s.length - 1) * q));
  return Math.round(s[i]!);
}

function fmt(metric: string, v: number) {
  if (metric === "CLS") return v.toFixed(3);
  return `${Math.round(v)} ms`;
}

export function PerfMetricsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<ErrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const [vitals, errs] = await Promise.all([
        supabase
          .from("web_vitals")
          .select("metric, value, app_version, platform, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("client_errors" as never)
          .select("id, created_at, kind, message, path, app_version, platform")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (vitals.error) throw vitals.error;
      setRows((vitals.data ?? []) as unknown as Row[]);
      // Erorile sunt opționale (tabela poate fi goală / fără drept de citire).
      setErrors(errs.error ? [] : ((errs.data ?? []) as unknown as ErrRow[]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /forbidden|denied|policy|permission|role/i.test(msg)
          ? `Acces refuzat — este nevoie de rol staff (admin / super_admin). Detaliu: ${msg}`
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const byVersion = useMemo(() => {
    const map = new Map<string, Map<string, number[]>>();
    for (const r of rows) {
      if (!TRACKED.includes(r.metric)) continue;
      const v = r.app_version ?? "necunoscut";
      if (!map.has(v)) map.set(v, new Map());
      const m = map.get(v)!;
      if (!m.has(r.metric)) m.set(r.metric, []);
      m.get(r.metric)!.push(Number(r.value));
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }));
  }, [rows]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Performanță pe device real</h2>
          <p className="text-xs text-muted-foreground">
            TTFR (first render), boot data, TTI și web-vitals — mediană / p75, per versiune de build.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            <option value={1}>Ultima zi</option>
            <option value={7}>7 zile</option>
            <option value={14}>14 zile</option>
            <option value={30}>30 zile</option>
          </select>
          <button
            onClick={() => void load()}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            Reîncearcă
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !error && byVersion.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Empty legitim — nicio măsurătoare în intervalul selectat.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/50">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Versiune</th>
                <th className="px-3 py-2">Măsurători</th>
                {TRACKED.map((m) => (
                  <th key={m} className="px-3 py-2">
                    {m.replace("app_", "")} (p50 / p75)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byVersion.map(([version, metrics]) => {
                const total = [...metrics.values()].reduce((a, b) => a + b.length, 0);
                return (
                  <tr key={version} className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium text-foreground">{version}</td>
                    <td className="px-3 py-2 text-muted-foreground">{total}</td>
                    {TRACKED.map((m) => {
                      const vals = metrics.get(m) ?? [];
                      return (
                        <td key={m} className="px-3 py-2">
                          {vals.length
                            ? `${fmt(m, p(vals, 0.5))} / ${fmt(m, p(vals, 0.75))}`
                            : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Erori raportate de pe device-uri ({errors.length})
        </h3>
        {errors.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Empty legitim — nicio eroare raportată în interval.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {errors.map((e) => (
              <li key={e.id} className="rounded-lg border border-border/40 bg-background/50 p-2 text-xs">
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  <span>{new Date(e.created_at).toLocaleString("ro-RO")}</span>
                  <span>· {e.kind}</span>
                  {e.app_version && <span>· v{e.app_version}</span>}
                  {e.platform && <span>· {e.platform}</span>}
                  {e.path && <span>· {e.path}</span>}
                </div>
                <div className="mt-1 break-words font-medium text-foreground">{e.message}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
