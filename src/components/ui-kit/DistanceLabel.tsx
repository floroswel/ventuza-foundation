import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance } from "@/lib/geo-bucket";

/**
 * Distanța se afișează întotdeauna bucketizată (vezi regula de locație);
 * primim metri deja bucketizați de la server și îi formatăm consistent.
 *
 * `approximate` marchează explicit distanțele calculate dintr-o locație aleasă
 * manual (mod Explorer) — nu prezentăm o distanță fictivă ca fapt.
 */
export function DistanceLabel({
  meters,
  className,
  iconClassName,
  approximate = false,
}: {
  meters: number | null | undefined;
  className?: string;
  iconClassName?: string;
  approximate?: boolean;
}) {
  if (meters == null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 leading-none", className)}>
      <MapPin className={cn("size-3 shrink-0", iconClassName)} aria-hidden />
      {approximate ? `~${formatDistance(meters)}` : formatDistance(meters)}
    </span>
  );
}
