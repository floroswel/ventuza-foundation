import { useEffect, useState } from "react";
import { Bug, Download, Copy, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  isDebugEnabled,
  setDebugEnabled,
  subscribe,
  clearEntries,
  exportAsJson,
  exportAsText,
  downloadBlob,
  buildSnapshot,
  type DebugEntry,
} from "@/lib/debug-logger";

/**
 * Panou plutitor cu logurile detaliate.
 * Vizibil DOAR când modul debug e activ (via /settings sau ?debug=1).
 * Ascunde tot în producție dacă flag-ul e OFF — zero overhead.
 */
export function DebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DebugEntry[]>([]);

  // Sync toggle state (URL / localStorage / setări)
  useEffect(() => {
    const refresh = () => setEnabled(isDebugEnabled());
    refresh();
    window.addEventListener("suzeta:debug-toggle", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("suzeta:debug-toggle", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Subscribe la ring buffer când e activ
  useEffect(() => {
    if (!enabled) return;
    return subscribe(setEntries);
  }, [enabled]);

  if (!enabled) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  return (
    <div className="fixed bottom-3 right-3 z-[9998] w-[min(420px,calc(100vw-1.5rem))] rounded-lg border border-border bg-background/95 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-t-lg bg-primary/10 px-3 py-2 text-left text-xs font-medium"
      >
        <span className="flex items-center gap-2">
          <Bug className="size-3.5" />
          Debug ({entries.length})
        </span>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
      </button>

      {open && (
        <div className="max-h-[60vh] overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
            <button
              type="button"
              onClick={() => downloadBlob(exportAsJson(), `suzeta-log-${stamp}.json`)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
              title="Export JSON"
            >
              <Download className="size-3" /> JSON
            </button>
            <button
              type="button"
              onClick={() => downloadBlob(exportAsText(), `suzeta-log-${stamp}.txt`)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
              title="Export text"
            >
              <Download className="size-3" /> TXT
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    JSON.stringify(buildSnapshot(), null, 2),
                  );
                  toast.success("Log copiat în clipboard");
                } catch {
                  toast.error("Nu am putut copia — folosește Export JSON");
                }
              }}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
              title="Copy JSON"
            >
              <Copy className="size-3" /> Copy
            </button>
            <button
              type="button"
              onClick={() => {
                clearEntries();
                toast("Log golit");
              }}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
              title="Golește"
            >
              <Trash2 className="size-3" /> Golește
            </button>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDebugEnabled(false);
                  toast("Debug mode dezactivat");
                }}
                className="inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                title="Oprește debug mode"
              >
                <X className="size-3" /> OFF
              </button>
            </div>
          </div>

          <ul className="max-h-[50vh] overflow-y-auto font-mono text-[11px] leading-tight">
            {entries.length === 0 ? (
              <li className="p-3 text-muted-foreground">
                Niciun eveniment încă. Reproduce problema — evenimentele apar aici automat.
              </li>
            ) : (
              entries
                .slice()
                .reverse()
                .map((e, i) => (
                  <li
                    key={`${e.ts}-${i}`}
                    className={`border-b border-border/50 px-2 py-1.5 ${levelColor(e.level)}`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 text-muted-foreground">
                        {e.ts.slice(11, 19)}
                      </span>
                      <span className="shrink-0 uppercase opacity-80">{e.level}</span>
                      <span className="shrink-0 opacity-80">{e.source}</span>
                    </div>
                    <div className="break-words">{e.message}</div>
                    {e.details !== undefined && (
                      <details className="mt-0.5">
                        <summary className="cursor-pointer text-muted-foreground">
                          detalii
                        </summary>
                        <pre className="whitespace-pre-wrap break-words text-[10px] opacity-80">
                          {safeStringify(e.details)}
                        </pre>
                      </details>
                    )}
                  </li>
                ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function levelColor(l: DebugEntry["level"]): string {
  switch (l) {
    case "error":
      return "text-destructive";
    case "warn":
      return "text-yellow-500";
    case "network":
      return "text-blue-400";
    case "event":
      return "text-purple-400";
    case "nav":
      return "text-muted-foreground";
    default:
      return "";
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2).slice(0, 2000);
  } catch {
    return String(v);
  }
}
