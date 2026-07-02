import { useState } from "react";
import { Bookmark, BookmarkPlus, X, Check } from "lucide-react";
import { useSavedViews, type SavedView } from "@/hooks/useSavedViews";

type Props<F> = {
  scope: string;                          // ex: "admin.support"
  currentFilters: F;                      // filtrele active (obiect serializabil)
  onApply: (filters: F) => void;          // callback la selectarea unei view
  compact?: boolean;
};

/**
 * Bară universală "Saved views" pentru orice panou admin.
 * - Salvează filtrele curente sub un nume (localStorage per scope).
 * - Click pe chip = aplică. X = șterge.
 * - Se restaurează automat "active view" la mount dacă panoul o cere:
 *   consumatorul poate lua `active` și apela onApply la mount o singură dată.
 */
export function SavedViewsBar<F>({ scope, currentFilters, onApply, compact }: Props<F>) {
  const { views, activeId, setActive, save, remove } = useSavedViews<F>(scope);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    save(trimmed, currentFilters);
    setName(""); setNaming(false);
  };

  const apply = (v: SavedView<F>) => { setActive(v.id); onApply(v.filters); };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Bookmark className="size-3" /> Views:
      </span>
      {views.length === 0 && !naming && (
        <span className="text-muted-foreground/60">niciuna salvată</span>
      )}
      {views.map((v) => (
        <span
          key={v.id}
          className={`group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${
            activeId === v.id
              ? "border-primary/50 bg-primary/15 text-foreground"
              : "border-border bg-surface/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          <button onClick={() => apply(v)} className="inline-flex items-center gap-1">
            {activeId === v.id && <Check className="size-2.5 text-primary" />}
            {v.name}
          </button>
          <button
            onClick={() => remove(v.id)}
            title="Șterge view"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Șterge view ${v.name}`}
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}
      {naming ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-surface px-2 py-0.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setNaming(false); setName(""); } }}
            placeholder="Nume view…"
            className="w-28 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/60"
          />
          <button onClick={commit} className="text-primary hover:text-primary/80" aria-label="Salvează">
            <Check className="size-3" />
          </button>
          <button onClick={() => { setNaming(false); setName(""); }} className="text-muted-foreground hover:text-foreground" aria-label="Anulează">
            <X className="size-3" />
          </button>
        </span>
      ) : (
        <button
          onClick={() => setNaming(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-muted-foreground hover:border-primary/50 hover:text-foreground"
        >
          <BookmarkPlus className="size-3" /> Salvează
        </button>
      )}
    </div>
  );
}
