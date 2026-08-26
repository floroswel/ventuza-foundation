import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicator unic de prezență.
 *
 * - online, în zonă        → bulină verde
 * - online, dar călător    → avion verde (aceeași mărime cu bulina), ca să se
 *                            vadă instant că persoana nu e din zonă
 * - offline                → nimic
 *
 * „Călător" = are un oraș de călătorie activ (setat din profil) sau este
 * raportat de server ca fiind departe. Nu calculăm și nu afișăm niciodată
 * coordonate sau distanță exactă.
 */
export function PresenceDot({
  online,
  traveler = false,
  className,
  title,
}: {
  online: boolean;
  traveler?: boolean;
  className?: string;
  title?: string;
}) {
  if (!online) return null;

  if (traveler) {
    return (
      <span
        title={title ?? "Online — în călătorie"}
        aria-label="Online, în călătorie"
        className={cn(
          "inline-flex shrink-0 items-center justify-center text-emerald-400 drop-shadow-[0_0_6px_rgb(52,211,153)]",
          className,
        )}
      >
        <Plane className="size-full -rotate-45" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span
      title={title ?? "Online"}
      aria-label="Online"
      className={cn(
        "inline-block shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]",
        className,
      )}
    />
  );
}

export default PresenceDot;
