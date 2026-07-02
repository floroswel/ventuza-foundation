import { useCallback, useEffect, useState } from "react";

export type SavedView<F> = { id: string; name: string; filters: F; createdAt: number };

/**
 * Per-operator, per-scope saved filter presets (localStorage).
 * Scope example: `admin.reports`, `admin.users`, `admin.support`.
 *
 * Server-side sharing across staff can be added later on top of this API.
 */
export function useSavedViews<F>(scope: string) {
  const key = `admin:views:${scope}`;
  const [views, setViews] = useState<Array<SavedView<F>>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      if (raw) setViews(JSON.parse(raw));
      const a = typeof window !== "undefined" ? localStorage.getItem(`${key}:active`) : null;
      if (a) setActiveId(a);
    } catch { /* ignore */ }
  }, [key]);

  const persist = useCallback((next: Array<SavedView<F>>) => {
    setViews(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }, [key]);

  const setActive = useCallback((id: string | null) => {
    setActiveId(id);
    try {
      if (id) localStorage.setItem(`${key}:active`, id);
      else localStorage.removeItem(`${key}:active`);
    } catch { /* ignore */ }
  }, [key]);

  const save = useCallback((name: string, filters: F) => {
    const id = crypto.randomUUID();
    const view: SavedView<F> = { id, name, filters, createdAt: Date.now() };
    persist([view, ...views]);
    setActive(id);
    return view;
  }, [views, persist, setActive]);

  const remove = useCallback((id: string) => {
    persist(views.filter((v) => v.id !== id));
    if (activeId === id) setActive(null);
  }, [views, activeId, persist, setActive]);

  const active = views.find((v) => v.id === activeId) ?? null;

  return { views, active, activeId, setActive, save, remove };
}
