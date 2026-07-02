import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus, ShieldAlert } from "lucide-react";

/** Glass surface card — uses [data-admin] tokens. */
export function GlassCard({
  children,
  className = "",
  elevated = false,
  padding = "p-4",
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: string;
}) {
  return (
    <div
      className={`rounded-2xl ${elevated ? "admin-glass-hi" : "admin-glass"} ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

/** Bloomberg-style monospaced number. */
export function MonoNumber({
  value,
  className = "",
  prefix,
  suffix,
}: {
  value: number | string | null | undefined;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const v =
    value === null || value === undefined
      ? "—"
      : typeof value === "number"
        ? value.toLocaleString("ro-RO")
        : String(value);
  return (
    <span className={`admin-mono ${className}`}>
      {prefix}
      {v}
      {suffix}
    </span>
  );
}

/** Compact KPI tile (replaces giant Stat cards). */
export function Kpi({
  label,
  value,
  delta,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: number | string | null | undefined;
  delta?: number | null;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "success";
  icon?: ReactNode;
}) {
  const toneRing =
    tone === "warn"
      ? "ring-1 ring-[var(--admin-warn)]/30"
      : tone === "danger"
        ? "ring-1 ring-[var(--admin-danger)]/40"
        : tone === "success"
          ? "ring-1 ring-[var(--admin-success)]/30"
          : "";

  let DeltaIcon = Minus;
  let deltaColor = "text-[var(--admin-text-faint)]";
  if (delta != null) {
    if (delta > 0) {
      DeltaIcon = TrendingUp;
      deltaColor = "text-[var(--admin-success)]";
    } else if (delta < 0) {
      DeltaIcon = TrendingDown;
      deltaColor = "text-[var(--admin-danger)]";
    }
  }

  return (
    <div className={`admin-glass rounded-xl p-3 ${toneRing}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--admin-text-dim)]">
          {label}
        </p>
        {icon && <span className="text-[var(--admin-text-faint)]">{icon}</span>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <MonoNumber
          value={value}
          className="text-2xl font-semibold leading-none text-[var(--admin-text)]"
        />
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] ${deltaColor}`}>
            <DeltaIcon className="size-3" />
            <span className="admin-mono">{delta > 0 ? `+${delta}` : delta}</span>
          </span>
        )}
      </div>
      {hint && <p className="mt-1 truncate text-[10px] text-[var(--admin-text-faint)]">{hint}</p>}
    </div>
  );
}

type StatusTone =
  | "pending"
  | "approved"
  | "rejected"
  | "active"
  | "suspended"
  | "banned"
  | "info"
  | "neutral";

const STATUS_STYLES: Record<StatusTone, string> = {
  pending: "bg-[var(--admin-warn-soft)] text-[var(--admin-warn)] ring-[var(--admin-warn)]/40",
  approved:
    "bg-[var(--admin-success-soft)] text-[var(--admin-success)] ring-[var(--admin-success)]/40",
  rejected:
    "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)] ring-[var(--admin-danger)]/40",
  active: "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)] ring-[var(--admin-accent)]/40",
  suspended: "bg-[var(--admin-warn-soft)] text-[var(--admin-warn)] ring-[var(--admin-warn)]/40",
  banned: "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)] ring-[var(--admin-danger)]/50",
  info: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
  neutral: "bg-white/5 text-[var(--admin-text-dim)] ring-white/10",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${STATUS_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

type Severity = "low" | "medium" | "high" | "critical";
const SEVERITY_MAP: Record<Severity, { cls: string; label: string }> = {
  low: { cls: "bg-white/5 text-[var(--admin-text-dim)] ring-white/10", label: "low" },
  medium: { cls: "bg-blue-500/15 text-blue-300 ring-blue-400/30", label: "medium" },
  high: {
    cls: "bg-[var(--admin-warn-soft)] text-[var(--admin-warn)] ring-[var(--admin-warn)]/50",
    label: "high",
  },
  critical: {
    cls: "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)] ring-[var(--admin-danger)]/60 shadow-[0_0_14px_-2px_oklch(0.66_0.21_25/0.5)]",
    label: "critical",
  },
};

export function SeverityBadge({ value }: { value: Severity | string | null | undefined }) {
  const key = (value ?? "low").toString().toLowerCase() as Severity;
  const cfg = SEVERITY_MAP[key] ?? SEVERITY_MAP.low;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${cfg.cls}`}
    >
      <ShieldAlert className="size-3" />
      {cfg.label}
    </span>
  );
}

/** Visible marker that a row contains GDPR Art. 9 data (no value disclosed). */
export function Art9Badge({ label = "Art. 9" }: { label?: string }) {
  return (
    <span
      title="Date din categorii speciale (Art. 9 GDPR) — vizibilitate prin break-glass"
      className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-art9-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-art9)] ring-1 ring-inset ring-[var(--admin-art9)]/40"
    >
      {label}
    </span>
  );
}

/** Section header with subtle gold accent line. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="block h-3 w-[3px] rounded-full bg-[var(--admin-accent)] shadow-[var(--admin-accent-glow)]" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-text-dim)]">
          {children}
        </h3>
      </div>
      {action}
    </div>
  );
}
