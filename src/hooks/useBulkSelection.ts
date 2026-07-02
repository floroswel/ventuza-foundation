import { useCallback, useMemo, useState } from "react";

/**
 * Selecție bulk generică pentru tabele admin.
 * - selected: Set<id> curent.
 * - toggle(id) / clear() / setMany(ids, checked).
 * - allChecked / someChecked ajută <input type=checkbox indeterminate>.
 * - Filtrează automat id-urile care nu mai există în listă (paginare).
 */
export function useBulkSelection<Row extends { id: string }>(rows: Row[]) {
  const [set, setSet] = useState<Set<string>>(() => new Set());
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const visibleSelected = useMemo(() => ids.filter((id) => set.has(id)), [ids, set]);

  const toggle = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setMany = useCallback((targetIds: string[], checked: boolean) => {
    setSet((prev) => {
      const next = new Set(prev);
      for (const id of targetIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSet(new Set()), []);

  const allChecked = ids.length > 0 && visibleSelected.length === ids.length;
  const someChecked = visibleSelected.length > 0 && !allChecked;

  return {
    selected: Array.from(set),
    selectedSet: set,
    count: set.size,
    visibleSelected,
    toggle,
    setMany,
    clear,
    allChecked,
    someChecked,
    isSelected: (id: string) => set.has(id),
    selectAllVisible: (checked: boolean) => setMany(ids, checked),
  };
}
