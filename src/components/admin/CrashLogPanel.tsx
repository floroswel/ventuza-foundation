import { useEffect, useState } from "react";
import { listCrashes, clearCrashes, type CrashEntry } from "@/lib/crash-log";

export function CrashLogPanel() {
  const [entries, setEntries] = useState<CrashEntry[]>([]);

  const refresh = () => setEntries(listCrashes());

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="rounded-2xl border border-border/50 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Crash log (device local)</h2>
          <p className="text-xs text-muted-foreground">
            Ultimele {entries.length} erori JS capturate pe acest device. Fără terți.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            Refresh
          </button>
          <button
            onClick={() => {
              clearCrashes();
              refresh();
            }}
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20"
          >
            Șterge
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Niciun crash înregistrat pe acest device.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map((e, i) => (
            <li
              key={`${e.ts}-${i}`}
              className="rounded-lg border border-border/40 bg-background/50 p-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                <span className="font-mono">{new Date(e.ts).toLocaleString()}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  {e.kind}
                </span>
              </div>
              <p className="mt-1 font-medium text-foreground break-words">{e.message}</p>
              {e.boundary && (
                <p className="mt-1 text-muted-foreground">boundary: {e.boundary}</p>
              )}
              {e.url && <p className="mt-1 text-muted-foreground break-all">{e.url}</p>}
              {e.stack && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
                  {e.stack}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
