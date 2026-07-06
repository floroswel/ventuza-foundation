import { useEffect, useState } from "react";
import { Bug, Download, Copy, Trash2 } from "lucide-react";
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
 * Card în /settings: activează / dezactivează modul „loguri detaliate"
 * și oferă butoane rapide de export. Panoul plutitor (DebugPanel) apare
 * doar când modul e activ.
 */
export function DebugModeCard() {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setEnabled(isDebugEnabled());
    refresh();
    window.addEventListener("ventuza:debug-toggle", refresh);
    return () => window.removeEventListener("ventuza:debug-toggle", refresh);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    return subscribe((es: DebugEntry[]) => setCount(es.length));
  }, [enabled]);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Bug className="size-3.5" /> Loguri detaliate
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Când e activ, aplicația reține local ultimele 500 evenimente (erori, rețea, navigare,
            evenimente de securitate) și îți afișează un panou plutitor cu buton de export
            JSON/text — perfect pentru a trimite rapid la suport ce s-a întâmplat.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Nu colectăm nimic în cloud. Totul rămâne pe dispozitivul tău până apeși Export.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="size-5"
            checked={enabled}
            onChange={(e) => {
              setDebugEnabled(e.target.checked);
              toast.success(e.target.checked ? "Debug mode activat" : "Debug mode dezactivat");
            }}
            aria-label="Activează modul de loguri detaliate"
          />
        </label>
      </div>

      {enabled && (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            {count === 0
              ? "Niciun eveniment încă. Reproduce problema — evenimentele apar automat."
              : `${count} evenimente înregistrate.`}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadBlob(exportAsJson(), `ventuza-log-${stamp}.json`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
              disabled={count === 0}
            >
              <Download className="size-3.5" /> Export JSON
            </button>
            <button
              type="button"
              onClick={() => downloadBlob(exportAsText(), `ventuza-log-${stamp}.txt`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
              disabled={count === 0}
            >
              <Download className="size-3.5" /> Export text
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
                  toast.error("Nu am putut copia — folosește Export");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
              disabled={count === 0}
            >
              <Copy className="size-3.5" /> Copiază
            </button>
            <button
              type="button"
              onClick={() => {
                clearEntries();
                toast("Log golit");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
              disabled={count === 0}
            >
              <Trash2 className="size-3.5" /> Golește
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
