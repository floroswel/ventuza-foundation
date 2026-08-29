/**
 * „Ce e nou azi" — motiv de revenire zilnică.
 * Doar agregate publice (membri noi, online acum, evenimente diseară).
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Users, CalendarClock } from "lucide-react";
import { fetchWhatsNew, type WhatsNew } from "@/lib/growth";

export function WhatsNewStrip() {
  const [data, setData] = useState<WhatsNew | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchWhatsNew().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  if (data.new_7d === 0 && data.online_now === 0 && data.events_tonight === 0) return null;

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto px-3 pt-2">
      <Chip
        icon={<Sparkles className="size-3.5" />}
        label={`${data.new_7d} noi săptămâna asta`}
      />
      <Chip icon={<Users className="size-3.5" />} label={`${data.online_now} online acum`} />
      {data.events_tonight > 0 && (
        <Link to="/events" className="shrink-0">
          <Chip
            icon={<CalendarClock className="size-3.5" />}
            label={`${data.events_tonight} evenimente diseară`}
            accent
          />
        </Link>
      )}
    </div>
  );
}

function Chip({
  icon,
  label,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${
        accent
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-surface text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}
