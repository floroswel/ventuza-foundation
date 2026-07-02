// Sprint A — shortcuts J/K navigare, A/D/E acțiuni, Enter deschide, Esc închide
import { useEffect } from "react";

export type ShortcutMap = {
  onNext?: () => void;      // J
  onPrev?: () => void;      // K
  onOpen?: () => void;      // Enter
  onClose?: () => void;     // Esc
  onApprove?: () => void;   // A
  onDeny?: () => void;      // D
  onEscalate?: () => void;  // E
  onReason?: () => void;    // Shift+R
  onRefresh?: () => void;   // R
  onClaim?: () => void;     // C
  enabled?: boolean;
};

export function useKeyboardShortcuts(map: ShortcutMap) {
  useEffect(() => {
    if (map.enabled === false) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j": map.onNext?.(); break;
        case "k": map.onPrev?.(); break;
        case "Enter": map.onOpen?.(); break;
        case "Escape": map.onClose?.(); break;
        case "a": case "A": map.onApprove?.(); break;
        case "d": case "D": map.onDeny?.(); break;
        case "e": case "E": map.onEscalate?.(); break;
        case "c": case "C": map.onClaim?.(); break;
        case "R": if (e.shiftKey) map.onReason?.(); break;
        case "r": if (!e.shiftKey) map.onRefresh?.(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}

export function ShortcutsHint({ items }: { items: Array<{ key: string; label: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[9px]">{it.key}</kbd>
          {it.label}
        </span>
      ))}
    </div>
  );
}
