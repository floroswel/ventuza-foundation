import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarHeart, Loader2, MapPin, Map as MapIcon, Plus, Users, Clock, List } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { listUpcomingEvents, eventTypeLabel, formatEventDate, type EventType, type EventWithMeta } from "@/lib/events";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { NotificationBell } from "@/components/NotificationBell";
import { EventsMap } from "@/components/EventsMap";
import { SponsoredBanner } from "@/components/SponsoredBanner";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";



export const Route = createFileRoute("/events")({
  head: () => ({ meta: [{ title: "Events — Ventuza" }, { name: "description", content: "Find gay-friendly parties, bars and meetups near you." }] }),
  component: EventsPage,
});

const TYPES: Array<EventType | "all"> = ["all", "party", "bar", "pride", "meetup", "other"];

function EventsPage() {
  const { user, loading: authLoading } = useAuth();
  
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<EventType | "all">("all");
  const [city, setCity] = useState("");
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");


  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const data = await listUpcomingEvents({ city, type });
      setEvents(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load events");
    } finally {
      setLoading(false);
    }
  }, [city, type]);

  useEffect(() => {
    if (!user) return;
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
  }, [user, load]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-3 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Events</h1>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[0_0_18px_-6px_var(--primary)] hover:opacity-90"
              title="Propune un eveniment (intră la moderare)"
            >
              <Plus className="size-3.5" /> Propune
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <div className="inline-flex rounded-full border border-border bg-surface p-0.5">
            <button
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-label="List view"
            >
              <List className="size-3.5" />
            </button>
            <button
              onClick={() => setView("map")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-label="Map view"
            >
              <MapIcon className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {t === "all" ? "All" : eventTypeLabel(t)}
            </button>
          ))}
        </div>

      </header>

      <div className="flex-1 px-3 py-3 space-y-3">
        <SponsoredBanner placement="events_banner" city={city} />

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={CalendarHeart}
            title="Niciun eveniment în curând"
            body="Evenimentele pot fi create doar de organizatorii verificați. Aplică pentru cont Business ca să găzduiești."
          />
        ) : view === "map" ? (

          <EventsMap events={events} />
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  to="/events/$id"
                  params={{ id: e.id }}
                  className="block overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary/60"
                >
                  <div className="flex gap-3 p-3">
                    <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="text-[10px] uppercase tracking-wider">{new Date(e.starts_at).toLocaleDateString(undefined, { month: "short" })}</span>
                      <span className="text-xl font-bold leading-none">{new Date(e.starts_at).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <h3 className="line-clamp-1 flex-1 text-sm font-semibold">{e.title}</h3>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {eventTypeLabel(e.event_type)}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatEventDate(e.starts_at)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {e.city}{e.venue ? ` · ${e.venue}` : ""}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" />
                          {e.going_count} going
                        </span>
                        {e.interested_count > 0 && <span>· {e.interested_count} interested</span>}
                        {e.my_rsvp && (
                          <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {e.my_rsvp === "going" ? "Going" : "Interested"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

      </div>

      <CreateEventDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setCreating(false);
          navigate({ to: "/events/$id", params: { id } });
        }}
      />
      <BottomNav />
    </main>
  );
}
