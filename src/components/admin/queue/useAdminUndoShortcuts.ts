// Shortcut-uri globale Cmd/Ctrl+Z pentru undo/redo în /admin.
// Fișier deliberat MINIMAL: nu importă `useActionJournal` sau `sonner`.
// Modulul greu se încarcă lenevos la prima combinație de taste, ca să nu intre
// în bundle-ul inițial al /admin (shell-ul montează hook-ul mereu, dar 99% din
// operatori nu apasă niciodată undo).
import { useEffect } from "react";

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
      if (editable) return;
      e.preventDefault();
      // Import lenevos — abia acum aducem journal-ul în bundle.
      import("./useActionJournal").then((m) => {
        if (e.shiftKey) void m.redoLast();
        else void m.undoLast();
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
