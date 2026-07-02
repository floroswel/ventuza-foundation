// Sprint A — SLA age badge (verde / galben / roșu în funcție de praguri per queue)
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Flame } from "lucide-react";

type Tone = "ok" | "warn" | "breach";
export type SlaThreshold = { warn_minutes: number; breach_minutes: number };

const TONE_CLS: Record<Tone, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  breach: "border-red-500/40 bg-red-500/10 text-red-200",
};

function fmt(mins: number): string {
  if (mins < 60) return `${Math.max(0, Math.round(mins))}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
  return `${Math.floor(mins / 60 / 24)}d ${Math.floor((mins / 60) % 24)}h`;
}

export function SlaBadge({
  createdAt,
  threshold,
  label = "vechime",
  compact = false,
}: {
  createdAt: string | Date | null | undefined;
  threshold?: SlaThreshold;
  label?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!createdAt) return null;

  const created = typeof createdAt === "string" ? Date.parse(createdAt) : createdAt.getTime();
  const ageMin = (now - created) / 60_000;

  const warn = threshold?.warn_minutes ?? 240;
  const breach = threshold?.breach_minutes ?? 1440;
  const tone: Tone = ageMin >= breach ? "breach" : ageMin >= warn ? "warn" : "ok";
  const Icon = tone === "breach" ? Flame : tone === "warn" ? AlertTriangle : Clock;

  return (
    <span
      title={`${label}: ${fmt(ageMin)} · SLA warn @${fmt(warn)} · breach @${fmt(breach)}`}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TONE_CLS[tone]}`}
    >
      <Icon className="size-2.5" />
      {compact ? fmt(ageMin) : `${label} ${fmt(ageMin)}`}
    </span>
  );
}
