import type { ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  count: number;
  onClear: () => void;
  children: ReactNode;
};

/**
 * Sticky bar shown when items in a table are selected. Pairs with DataTable
 * bulk selection. Slot in <Button> children for bulk actions.
 */
export function BulkActionBar({ count, onClear, children }: Props) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-primary/40 bg-surface/95 px-4 py-2 shadow-[0_20px_60px_-15px_oklch(0.82_0.115_85/0.35)] backdrop-blur-xl">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary admin-mono">
          {count}
        </span>
        <span className="text-xs font-medium text-foreground">selectate</span>
        <div className="mx-1 h-4 w-px bg-border" />
        <div className="flex items-center gap-2">{children}</div>
        <button
          onClick={onClear}
          className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          aria-label="Golește selecția"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
