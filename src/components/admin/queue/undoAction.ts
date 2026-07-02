// Sprint A — execuție cu fereastră de Undo (5s toast) înainte de a rula acțiunea reală
import { toast } from "sonner";

export type UndoOptions = {
  label: string;                          // "Ban aplicat pentru @user"
  undoLabel?: string;                     // "Undo"
  timeoutMs?: number;                     // 5000
  onCommit: () => Promise<void> | void;   // rulat DACĂ nu s-a apăsat undo
  onUndo?: () => void;                    // callback opțional la anulare
};

/**
 * Amână execuția `onCommit` cu N ms și afișează un toast cu buton Undo.
 * Dacă userul apasă Undo înainte de expirare, onCommit NU se execută.
 * Ideal pentru: ban, hide, close ticket, mute, delete row (reversibile).
 */
export function withUndo(opts: UndoOptions) {
  const { label, undoLabel = "Undo", timeoutMs = 5000, onCommit, onUndo } = opts;
  let undone = false;
  const timer = setTimeout(async () => {
    if (undone) return;
    try { await onCommit(); }
    catch (e: any) { toast.error(e?.message ?? "Eroare la aplicare"); }
  }, timeoutMs);

  toast(label, {
    duration: timeoutMs,
    action: {
      label: undoLabel,
      onClick: () => { undone = true; clearTimeout(timer); onUndo?.(); toast.success("Anulat"); },
    },
  });
}
