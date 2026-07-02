import { useState } from "react";
import { Undo2, Redo2, History, Loader2 } from "lucide-react";
import { useActionJournal } from "./useActionJournal";

/**
 * Toolbar cu Undo/Redo + dropdown istoric.
 * Se montează în header-ul AdminShell — o singură instanță globală.
 */
export function UndoRedoToolbar() {
  const { past, future, busy, canUndo, canRedo, undo, redo } = useActionJournal();
  const [open, setOpen] = useState(false);
  const last = past[past.length - 1];

  return (
    <div className="relative flex items-center gap-1 rounded-full border border-border/60 bg-surface/60 px-1.5 py-1 text-xs">
      <button
        onClick={() => void undo()}
        disabled={!canUndo || busy}
        title={canUndo ? `Undo: ${last?.label} (⌘Z)` : "Nimic de anulat"}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label="Undo"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
        <span className="hidden xl:inline">Undo</span>
      </button>
      <button
        onClick={() => void redo()}
        disabled={!canRedo || busy}
        title={canRedo ? `Redo: ${future[future.length - 1]?.label} (⌘⇧Z)` : "Nimic de refăcut"}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label="Redo"
      >
        <Redo2 className="size-3.5" />
        <span className="hidden xl:inline">Redo</span>
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground hover:text-foreground"
        aria-label="Istoric acțiuni"
        title="Istoric acțiuni"
      >
        <History className="size-3.5" />
        <span className="hidden xl:inline">{past.length}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-2 shadow-xl">
          <div className="mb-1 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Istoric ({past.length}) · Redo ({future.length})
          </div>
          {past.length === 0 && future.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Fără acțiuni în această sesiune.
            </p>
          )}
          {[...past].reverse().map((e, i) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-surface-elevated"
            >
              <span className="truncate">
                <span className="text-muted-foreground">{i === 0 ? "→ " : "  "}</span>
                {e.label}
              </span>
              <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                {new Date(e.ts).toLocaleTimeString("ro-RO")}
              </span>
            </div>
          ))}
          {future.length > 0 && (
            <div className="mt-1 border-t border-border/50 pt-1">
              {future.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-xs text-muted-foreground/70"
                >
                  <span className="truncate">↻ {e.label}</span>
                  <span className="ml-2 shrink-0 text-[10px]">
                    {new Date(e.ts).toLocaleTimeString("ro-RO")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
