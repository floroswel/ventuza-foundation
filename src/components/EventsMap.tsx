import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Users } from "lucide-react";
import type { EventWithMeta } from "@/lib/events";
import { eventTypeLabel, formatEventDate } from "@/lib/events";

/**
 * Lightweight relative map: places event pins on a square grid using
 * normalized lat/lng. No external map provider, no API keys.
 */
export function EventsMap({ events }: { events: EventWithMeta[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const positioned = useMemo(() => {
    const withCoords = events.filter((e) => e.lat != null && e.lng != null) as Array<
      EventWithMeta & { lat: number; lng: number }
    >;
    if (withCoords.length === 0) return [] as Array<EventWithMeta & { x: number; y: number }>;

    const lats = withCoords.map((e) => e.lat);
    const lngs = withCoords.map((e) => e.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const dLat = maxLat - minLat || 0.01;
    const dLng = maxLng - minLng || 0.01;

    return withCoords.map((e) => {
      const x = 10 + ((e.lng - minLng) / dLng) * 80; // 10..90 %
      const y = 90 - ((e.lat - minLat) / dLat) * 80; // invert so north up
      return { ...e, x, y };
    });
  }, [events]);

  const selectedEvent = positioned.find((e) => e.id === selected) ?? null;
  const missingCoords = events.length - positioned.length;

  if (positioned.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        <MapPin className="mx-auto mb-2 size-8 text-primary/60" />
        Niciun eveniment cu locație pe hartă încă.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-primary/5">
        {/* grid */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklab, var(--primary) 18%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--primary) 18%, transparent) 1px, transparent 1px)",
            backgroundSize: "12.5% 12.5%",
          }}
        />
        {/* pins */}
        {positioned.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelected(e.id === selected ? null : e.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
            aria-label={e.title}
          >
            <span
              className={`flex size-8 items-center justify-center rounded-full border-2 shadow-lg ${
                selected === e.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/60 bg-background text-primary"
              }`}
            >
              <MapPin className="size-4" />
            </span>
          </button>
        ))}
      </div>

      {selectedEvent && (
        <Link
          to="/events/$id"
          params={{ id: selectedEvent.id }}
          className="block overflow-hidden rounded-2xl border border-primary/40 bg-surface p-3 transition hover:border-primary"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/15 text-primary">
              <span className="text-[9px] uppercase">{new Date(selectedEvent.starts_at).toLocaleDateString(undefined, { month: "short" })}</span>
              <span className="text-lg font-bold leading-none">{new Date(selectedEvent.starts_at).getDate()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold">{selectedEvent.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatEventDate(selectedEvent.starts_at)}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {selectedEvent.city}
                {selectedEvent.venue ? ` · ${selectedEvent.venue}` : ""}
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  {eventTypeLabel(selectedEvent.event_type)}
                </span>
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="size-3" />
                {selectedEvent.going_count} going
              </p>
            </div>
          </div>
        </Link>
      )}

      {missingCoords > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {missingCoords} eveniment{missingCoords === 1 ? "" : "e"} fără locație nu apar pe hartă.
        </p>
      )}
    </div>
  );
}
