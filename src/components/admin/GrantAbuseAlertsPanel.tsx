/**
 * Alerte de abuz în acordări/compensații.
 * Praguri din `app_settings.grant_abuse_thresholds`; date citite prin RPC
 * gated pe `is_staff`. Pattern obligatoriu admin: loading / error / empty legitim.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  adminGetGrantAbuseAlerts,
  adminGetGrantAbuseThresholds,
  type GrantAbuseAlert,
} from "@/lib/admin-grant-alerts.functions";

const LABELS: Record<string, string> = {
  grants_burst_actor: "Volum mare de acordări",
  grants_amount_actor: "Sumă acordată peste prag",
  grants_repeat_target: "Acordări repetate către același user",
  grants_night_activity: "Acordări în interval de noapte",
};

function sevClass(s: string) {
  return s === "critical"
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : s === "warning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
      : "border-border bg-surface/40 text-muted-foreground";
}

export function GrantAbuseAlertsPanel() {
  const alertsFn = useServerFn(adminGetGrantAbuseAlerts);
  const thresholdsFn = useServerFn(adminGetGrantAbuseThresholds);
  const [alerts, setAlerts] = useState<GrantAbuseAlert[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, t] = await Promise.all([alertsFn({ data: { days } }), thresholdsFn({})]);
      setAlerts(a.alerts);
      setThresholds(t.thresholds ?? {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /forbidden|denied|rol|role|policy|permission/i.test(msg)
          ? `Acces refuzat — necesită rol staff. ${msg}`
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }, [alertsFn, thresholdsFn, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alerte acordări & compensații</h2>
          <p className="text-xs text-muted-foreground">
            Praguri active: {thresholds["max_grants_per_actor"] ?? "—"} acordări /
            {" "}
            {thresholds["window_hours"] ?? 24}h · max{" "}
            {((thresholds["max_amount_cents_per_actor"] ?? 0) / 100).toFixed(2)} unități valorice ·
            max {thresholds["max_grants_same_target"] ?? "—"} către același user.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
          >
            <option value={7}>7 zile</option>
            <option value={14}>14 zile</option>
            <option value={30}>30 zile</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold"
          >
            <RefreshCw className="size-3.5" /> Reîncarcă
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Se analizează acordările…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="break-words">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-lg border border-destructive/40 px-3 py-1 text-xs font-semibold"
          >
            Reîncearcă
          </button>
        </div>
      ) : alerts.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface/40 p-4 text-sm text-muted-foreground">
          Empty legitim: niciun semnal de abuz în intervalul selectat.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li
              key={`${a.code}-${a.actor_id}-${a.target_user_id}-${i}`}
              className={`rounded-xl border p-3 text-xs ${sevClass(a.severity)}`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-3.5" />
                {LABELS[a.code] ?? a.code}
              </div>
              <p className="mt-1 text-foreground">{a.message}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                moderator: {a.actor_id ?? "—"}
                {a.target_user_id ? ` · user: ${a.target_user_id}` : ""} · observat:{" "}
                {Number(a.observed)} / prag: {Number(a.threshold)} ·{" "}
                {a.last_at ? new Date(a.last_at).toLocaleString("ro-RO") : "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
