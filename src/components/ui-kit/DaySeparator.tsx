import { safeFormat } from "@/lib/safe-locale";

/**
 * Separator de zi în firul de conversație — linie subțire + etichetă centrală
 * („AZI”, „IERI”, sau data). Pur prezentațional.
 */
export function DaySeparator({ iso }: { iso: string }) {
  return (
    <li className="flex items-center gap-3 py-2" aria-hidden={false}>
      <span className="h-px flex-1 bg-border/70" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {dayLabel(iso)}
      </span>
      <span className="h-px flex-1 bg-border/70" />
    </li>
  );
}

export function dayKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Azi";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Ieri";
  return safeFormat(d, { day: "numeric", month: "long" }, "date");
}
