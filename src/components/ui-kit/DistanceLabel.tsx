import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance } from "@/lib/geo-bucket";

/**
 * Distanța se afișează întotdeauna bucketizată (vezi regula de locație);
 * primim metri deja bucketizați de la server și îi formatăm consistent.
 */
export function DistanceLabel({
  meters,
  className,
  iconClassName,
}: {
  meters: number | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  if (meters == null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 leading-none", className)}>
      <MapPin className={cn("size-3 shrink-0", iconClassName)} aria-hidden />
      {formatDistance(meters)}
    </span>
  );
}
