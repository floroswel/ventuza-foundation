import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetOverview } from "@/lib/admin.functions";
import { Activity, AlertTriangle, Database, Cpu, Globe, RefreshCw, ShieldCheck, Loader2 } from "lucide-react";

type Probe = { label: string; ok: boolean; detail: string; latency?: number };

export function SystemHealthPanel() {
  const getOverview = useServerFn(adminGetOverview);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setFatal(null);
    try {
    const results: Probe[] = [];

    // 1. Backend RPC roundtrip
    const t0 = performance.now();
    try {
      await getOverview();
      results.push({
        label: "Backend RPC (admin_overview)",
        ok: true,
        detail: "200 OK",
        latency: Math.round(performance.now() - t0),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ label: "Backend RPC (admin_overview)", ok: false, detail: msg.slice(0, 120) });
    }

    // 2. Edge connectivity (self ping)
    const t1 = performance.now();
    try {
      const r = await fetch(window.location.origin + "/", { method: "HEAD" });
      results.push({
        label: "Edge / CDN",
        ok: r.ok,
        detail: `HTTP ${r.status}`,
        latency: Math.round(performance.now() - t1),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ label: "Edge / CDN", ok: false, detail: msg.slice(0, 120) });
    }

    // 3. Browser features
    results.push({
      label: "Service Worker / Push",
      ok: "serviceWorker" in navigator && "PushManager" in window,
      detail: "serviceWorker" in navigator ? "disponibil" : "indisponibil",
    });
    results.push({
      label: "Geolocation API",
      ok: "geolocation" in navigator,
      detail: "geolocation" in navigator ? "disponibil" : "indisponibil",
    });

      setProbes(results);
      setLastCheck(new Date());
    } catch (e: unknown) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run(); /* eslint-disable-next-line */
  }, []);

  const allOk = probes.every((p) => p.ok);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">System Health</h2>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            loading
              ? "border-border bg-surface text-muted-foreground"
              : allOk
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          <Activity className="size-3" />
          {loading ? "verific…" : allOk ? "Toate sistemele OK" : "Anomalii detectate"}
        </div>
        <button
          onClick={run}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-elevated"
        >
          <RefreshCw className="size-3" /> Verifică
        </button>
      </div>

      {fatal && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Eroare la rularea probelor</p>
              <p className="mt-1 break-words text-xs text-red-200/90">{fatal}</p>
              <button
                onClick={run}
                className="mt-2 rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
              >
                Reîncearcă
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && probes.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Rulez probe…
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {probes.map((p, i) => {
            const Icon = i === 0 ? Database : i === 1 ? Globe : i === 2 ? Cpu : ShieldCheck;
            return (
              <div
                key={p.label}
                className="relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`grid size-10 place-items-center rounded-xl ${p.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.detail}</p>
                  </div>
                  {p.latency != null && (
                    <span className="rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {p.latency}ms
                    </span>
                  )}
                  <span
                    className={`size-2 rounded-full ${p.ok ? "bg-emerald-400 shadow-[0_0_8px_oklch(0.78_0.18_150/0.7)]" : "bg-red-400"}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastCheck && (
        <p className="text-[10px] text-muted-foreground">
          Ultima verificare: {lastCheck.toLocaleTimeString("ro-RO")}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <h3 className="text-sm font-semibold">Reguli active (din AGENTS.md)</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>• Locație precisă — niciodată către alți useri. Doar bucket.</li>
          <li>
            • Orientare/mesaje/selfie — doar Break-glass cu justificare. (HIV: eliminat complet.)
          </li>
          <li>• CSAM — fără randare imagini. Doar hash.</li>
          <li>• Moderare obligatorie pentru venues/events/offers.</li>
          <li>
            • Consimțăminte centralizate în <code>consent_kinds()</code>.
          </li>
        </ul>
      </section>
    </div>
  );
}
