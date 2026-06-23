import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Golden Hour: 18:00–20:00 local — surfaces a warm-glow badge.
 * Returns minutes-until or minutes-remaining for countdown.
 */
export function useGoldenHour() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const h = now.getHours();
  const m = now.getMinutes();
  const active = h >= 18 && h < 20;
  const minutesLeft = active ? (20 - h) * 60 - m : 0;
  const minutesUntil = !active && h < 18 ? (18 - h) * 60 - m : 0;
  return { active, minutesLeft, minutesUntil };
}

export function GoldenHourBadge({ className }: { className?: string }) {
  const { active, minutesLeft } = useGoldenHour();
  if (!active) return null;
  const hrs = Math.floor(minutesLeft / 60);
  const mins = minutesLeft % 60;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-gradient-to-r from-amber-500/20 via-primary/25 to-amber-500/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary glow-gold",
        className,
      )}
      title="Golden Hour — community is most active between 18:00 and 20:00"
    >
      <Sparkles className="size-3 animate-pulse" />
      Golden Hour
      <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] tabular-nums text-primary-foreground/90">
        {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
      </span>
    </span>
  );
}
