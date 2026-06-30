/**
 * AutoRefreshSelect — preferință admin pentru intervalul de auto-refresh
 * al widget-urilor de risc/securitate. Persistată în localStorage și
 * sincronizată între componente prin event `admin:auto-refresh-changed`.
 */
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

const STORAGE_KEY = "admin.autoRefreshMs";
const EVENT = "admin:auto-refresh-changed";

export const AUTO_REFRESH_OPTIONS: { v: number; l: string }[] = [
  { v: 0, l: "Off" },
  { v: 15_000, l: "15s" },
  { v: 30_000, l: "30s" },
  { v: 60_000, l: "60s" },
  { v: 120_000, l: "2m" },
];

const DEFAULT_MS = 30_000;

function readPref(): number {
  if (typeof window === "undefined") return DEFAULT_MS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_MS;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_MS;
    // doar valori cunoscute
    return AUTO_REFRESH_OPTIONS.some((o) => o.v === n) ? n : DEFAULT_MS;
  } catch {
    return DEFAULT_MS;
  }
}

/** Hook: returnează intervalul curent (ms) și se reactualizează când preferința se schimbă. */
export function useAdminAutoRefresh(): number {
  const [ms, setMs] = useState<number>(() => readPref());
  useEffect(() => {
    const sync = () => setMs(readPref());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) sync();
    });
    return () => {
      window.removeEventListener(EVENT, sync);
    };
  }, []);
  return ms;
}

export function setAdminAutoRefresh(ms: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(ms));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function AutoRefreshSelect({ className = "" }: { className?: string }) {
  const ms = useAdminAutoRefresh();
  return (
    <label
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-xs ${className}`}
      title="Interval auto-refresh pentru widget-urile de risc/securitate"
    >
      <Timer className="size-3 text-muted-foreground" />
      <span className="text-muted-foreground">Auto</span>
      <select
        value={ms}
        onChange={(e) => setAdminAutoRefresh(Number(e.target.value))}
        className="bg-transparent text-xs outline-none"
        aria-label="Interval auto-refresh"
      >
        {AUTO_REFRESH_OPTIONS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
