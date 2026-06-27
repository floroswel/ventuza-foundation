import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, XCircle, Activity } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: "Status sistem · Ventuza" },
      { name: "description", content: "Stare în timp real a serviciilor Ventuza: API, mesagerie, autentificare, stocare." },
    ],
  }),
});

type Check = { name: string; status: "ok" | "degraded" | "down"; latencyMs: number | null; note?: string };

function StatusPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  async function runChecks() {
    setLoading(true);
    const out: Check[] = [];

    // DB read
    const t1 = performance.now();
    try {
      const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
      const ms = Math.round(performance.now() - t1);
      out.push({ name: "Bază de date", status: error ? "down" : ms > 1500 ? "degraded" : "ok", latencyMs: ms, note: error?.message });
    } catch (e) {
      out.push({ name: "Bază de date", status: "down", latencyMs: null, note: String(e) });
    }

    // Auth
    const t2 = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      const ms = Math.round(performance.now() - t2);
      out.push({ name: "Autentificare", status: error ? "down" : "ok", latencyMs: ms });
    } catch {
      out.push({ name: "Autentificare", status: "down", latencyMs: null });
    }

    // Storage signed URL
    const t3 = performance.now();
    try {
      const { error } = await supabase.storage.from("profile-photos").list("", { limit: 1 });
      const ms = Math.round(performance.now() - t3);
      out.push({ name: "Stocare media", status: error ? "degraded" : "ok", latencyMs: ms, note: error?.message });
    } catch {
      out.push({ name: "Stocare media", status: "down", latencyMs: null });
    }

    // Realtime
    const t4 = performance.now();
    try {
      const ch = supabase.channel("status-probe-" + Date.now());
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 4000);
        ch.subscribe((s) => {
          if (s === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
        });
      });
      void supabase.removeChannel(ch);
      const ms = Math.round(performance.now() - t4);
      out.push({ name: "Realtime / chat", status: ms > 2500 ? "degraded" : "ok", latencyMs: ms });
    } catch {
      out.push({ name: "Realtime / chat", status: "down", latencyMs: null });
    }

    setChecks(out);
    setLastRun(new Date());
    setLoading(false);
  }

  useEffect(() => { void runChecks(); const id = setInterval(runChecks, 60_000); return () => clearInterval(id); }, []);

  const overall: "ok" | "degraded" | "down" =
    checks.some((c) => c.status === "down") ? "down" :
    checks.some((c) => c.status === "degraded") ? "degraded" : "ok";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-4"><BackButton fallback="/" /></div>
      <header className="mb-6 flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Status sistem</h1>
      </header>


      <div className={`mb-6 rounded-2xl border p-5 ${overall === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : overall === "degraded" ? "border-amber-500/30 bg-amber-500/5" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center gap-3">
          {overall === "ok" ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : overall === "degraded" ? <AlertTriangle className="h-6 w-6 text-amber-500" /> : <XCircle className="h-6 w-6 text-destructive" />}
          <div>
            <p className="font-semibold">
              {overall === "ok" ? "Toate sistemele funcționează" : overall === "degraded" ? "Funcționare degradată" : "Incident în desfășurare"}
            </p>
            <p className="text-xs text-muted-foreground">
              {lastRun ? `Verificat la ${lastRun.toLocaleTimeString("ro-RO")}` : "Se verifică…"}
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.name} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              {c.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : c.status === "degraded" ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
              <span className="text-sm font-medium">{c.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {c.latencyMs != null ? `${c.latencyMs} ms` : "—"}
            </span>
          </li>
        ))}
        {loading && checks.length === 0 && <li className="text-sm text-muted-foreground">Se verifică serviciile…</li>}
      </ul>

      <p className="mt-8 text-xs text-muted-foreground">
        Pentru raportarea unui incident de securitate scrie la{" "}
        <a href="mailto:security@ventuza.app" className="text-primary underline">security@ventuza.app</a>{" "}
        sau consultă{" "}
        <a href="/.well-known/security.txt" className="text-primary underline">security.txt</a>.
      </p>
    </div>
  );
}
