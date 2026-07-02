import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

export type Column<T> = {
  key: string;
  header: string;
  /** Render cell content. */
  cell: (row: T) => ReactNode;
  /** Value used for sorting / CSV export. Defaults to cell output if string/number. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Plain text for global search. Defaults to sortValue. */
  searchValue?: (row: T) => string | null | undefined;
  className?: string;
  align?: "left" | "right" | "center";
  /** 1 = always visible, 2 = sm+, 3 = lg+ */
  priority?: 1 | 2 | 3;
  width?: string;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  initialPageSize?: 10 | 25 | 50 | 100;
  emptyLabel?: string;
  toolbar?: ReactNode;
  exportName?: string;
  onRowClick?: (row: T) => void;
};

const HIDE_BY_PRIORITY: Record<number, string> = {
  1: "",
  2: "hidden sm:table-cell",
  3: "hidden lg:table-cell",
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder = "Caută…",
  initialPageSize = 25,
  emptyLabel = "Niciun rând.",
  toolbar,
  exportName,
  onRowClick,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      columns.some((c) => {
        const sv = c.searchValue?.(row) ?? c.sortValue?.(row);
        if (sv == null) return false;
        return String(sv).toLowerCase().includes(query);
      }),
    );
  }, [rows, columns, q]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const exportCsv = () => {
    const header = columns.map((c) => csvCell(c.header)).join(",");
    const lines = sorted.map((r) =>
      columns
        .map((c) => {
          const v = c.sortValue?.(r) ?? c.searchValue?.(r) ?? "";
          return csvCell(String(v));
        })
        .join(","),
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--admin-text-faint)]" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="admin-mono w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1.5 pl-9 pr-3 text-xs text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-faint)] focus:border-[var(--admin-accent)]/60"
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1.5 text-xs text-[var(--admin-text-dim)]"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / pagină
            </option>
          ))}
        </select>
        {exportName && (
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1.5 text-xs text-[var(--admin-text-dim)] hover:border-[var(--admin-accent)]/60 hover:text-[var(--admin-text)]"
          >
            <Download className="size-3" /> CSV
          </button>
        )}
        {toolbar}
      </div>

      <div className="admin-glass overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02]">
                {columns.map((c) => {
                  const sortable = !!c.sortValue;
                  const active = sort?.key === c.key;
                  const Icon = !active ? ArrowUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.key}
                      style={c.width ? { width: c.width } : undefined}
                      className={`${HIDE_BY_PRIORITY[c.priority ?? 1]} px-3 py-2 text-${c.align ?? "left"} text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-dim)]`}
                    >
                      {sortable ? (
                        <button
                          onClick={() => toggleSort(c.key)}
                          className={`inline-flex items-center gap-1 hover:text-[var(--admin-text)] ${active ? "text-[var(--admin-accent)]" : ""}`}
                        >
                          {c.header}
                          <Icon className="size-3 opacity-70" />
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`admin-row border-b border-[var(--admin-border)]/40 transition-colors hover:bg-[var(--admin-accent-soft)]/30 ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`${HIDE_BY_PRIORITY[c.priority ?? 1]} px-3 py-2 text-${c.align ?? "left"} align-middle text-[var(--admin-text)] ${c.className ?? ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-10 text-center text-xs text-[var(--admin-text-faint)]"
                  >
                    {emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-[var(--admin-text-dim)]">
        <span className="admin-mono">
          {sorted.length === 0
            ? "0 rezultate"
            : `${page * pageSize + 1}–${Math.min(sorted.length, (page + 1) * pageSize)} / ${sorted.length}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex items-center rounded-md border border-[var(--admin-border)] px-2 py-1 disabled:opacity-30"
          >
            <ChevronLeft className="size-3" />
          </button>
          <span className="admin-mono px-2">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center rounded-md border border-[var(--admin-border)] px-2 py-1 disabled:opacity-30"
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
