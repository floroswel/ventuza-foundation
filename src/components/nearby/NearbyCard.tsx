import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Tag } from "lucide-react";
import type { NearbyPoint } from "@/lib/nearby.functions";
import { formatDistance } from "@/lib/geo-bucket";

type Props = {
  point: NearbyPoint & { distanceM: number };
  onSelect?: (p: NearbyPoint) => void;
};

export function NearbyCard({ point, onSelect }: Props) {
  const isEvent = point.kind === "event";
  const isOffer = point.kind === "offer";
  const isVenue = point.kind === "venue";

  const Icon = isEvent ? Calendar : isOffer ? Tag : MapPin;
  const kindLabel = isEvent ? "Eveniment" : isOffer ? "Ofertă" : "Local";

  const startTime = point.starts_at
    ? new Date(point.starts_at).toLocaleString("ro-RO", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const detailTo = isEvent ? "/events/$id" : isOffer ? "/offers/$id" : "/venues/$id";

  return (
    <Card className="overflow-hidden flex flex-col">
      {point.cover_url ? (
        <div
          className="h-32 w-full bg-cover bg-center bg-muted"
          style={{ backgroundImage: `url(${point.cover_url})` }}
        />
      ) : (
        <div className="h-32 w-full bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="h-8 w-8 opacity-50" />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Badge variant="secondary" className="text-xs">
                <Icon className="h-3 w-3 mr-1" />
                {kindLabel}
              </Badge>
              {point.category && (
                <Badge variant="outline" className="text-xs">
                  {point.category}
                </Badge>
              )}
              {/* "Founder" prioritized-access badge removed — see nearby.tsx
                  comment. Reintroduce together with a server-backed source. */}
            </div>
            <h3 className="font-semibold text-sm truncate">{point.name}</h3>
            {point.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {point.description}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold text-primary">
              {formatDistance(point.distanceM)}
            </div>
            {point.city && <div className="text-[10px] text-muted-foreground">{point.city}</div>}
          </div>
        </div>
        {startTime && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {startTime}
          </div>
        )}
        <div className="flex gap-2 mt-auto pt-2">
          <Button asChild size="sm" variant="default" className="flex-1">
            <Link to={detailTo} params={{ id: isOffer || isVenue ? point.id : point.id }}>
              {isEvent ? "Detalii / RSVP" : isOffer ? "Revendică" : "Detalii"}
            </Link>
          </Button>
          {onSelect && (
            <Button size="sm" variant="outline" onClick={() => onSelect(point)}>
              Pe hartă
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
