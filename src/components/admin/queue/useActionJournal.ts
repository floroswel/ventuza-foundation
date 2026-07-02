// Journal de acțiuni admin cu undo/redo multi-pas.
// - Fiecare acțiune reversibilă apelează pushAction({label, undo, redo}).
// - Undo (Cmd/Ctrl+Z) execută inversul; redo (Cmd/Ctrl+Shift+Z) re-aplică.
// - Store la nivel de modul → o singură istorie per operator per sesiune.
// - Cap 50 intrări. Nu se persistă în storage (evită re-execuție la reload).
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type JournalEntry = {
  id: string;
  label: string;
  ts: number;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
};

const MAX = 50;
const state = {
  past: [] as JournalEntry[],
  future: [] as JournalEntry[],
  busy: false,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function makeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

export function pushAction(input: {
  label: string;
  undo: JournalEntry["undo"];
  redo: JournalEntry["redo"];
}) {
  const entry: JournalEntry = { id: makeId(), ts: Date.now(), ...input };
  state.past.push(entry);
  if (state.past.length > MAX) state.past.shift();
  state.future = []; // orice acțiune nouă șterge redo
  emit();
}

export async function undoLast() {
  if (state.busy) return;
  const entry = state.past[state.past.length - 1];
  if (!entry) {
    toast("Nimic de anulat");
    return;
  }
  state.busy = true;
  emit();
  try {
    await entry.undo();
    state.past.pop();
    state.future.push(entry);
    toast.success(`Anulat: ${entry.label}`);
  } catch (e: any) {
    toast.error(`Undo eșuat: ${e?.message ?? "eroare"}`);
  } finally {
    state.busy = false;
    emit();
  }
}

export async function redoLast() {
  if (state.busy) return;
  const entry = state.future[state.future.length - 1];
  if (!entry) {
    toast("Nimic de refăcut");
    return;
  }
  state.busy = true;
  emit();
  try {
    await entry.redo();
    state.future.pop();
    state.past.push(entry);
    toast.success(`Refăcut: ${entry.label}`);
  } catch (e: any) {
    toast.error(`Redo eșuat: ${e?.message ?? "eroare"}`);
  } finally {
    state.busy = false;
    emit();
  }
}

export function clearJournal() {
  state.past = [];
  state.future = [];
  emit();
}

export function useActionJournal() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    past: state.past,
    future: state.future,
    busy: state.busy,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo: undoLast,
    redo: redoLast,
    clear: clearJournal,
  };
}

/** Hook global — se montează o singură dată în AdminShell ca să prindă Cmd/Ctrl+Z. */
export function useAdminUndoShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if (editable) return; // lasă editarea nativă în form-uri
      e.preventDefault();
      if (e.shiftKey) void redoLast();
      else void undoLast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
