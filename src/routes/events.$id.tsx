import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Clock, Loader2, MapPin, Trash2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import {
  deleteEvent,
  eventTypeLabel,
  formatEventDate,
  getEvent,
  listEventAttendees,
  setRsvp,
  type EventWithMeta,
  type RsvpStatus,
} from "@/lib/events";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/events/$id")({
  head: () => ({ meta: [{ title: "Event — Ventuza" }] }),
  component: EventDetailPage,
});

type Attendee = {
  user_id: string;
  status: RsvpStatus;
  display_name: string | null;
  photo: string | null;
};

async function signPhoto(p: string | null): Promise<string | null> {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
  return data?.signedUrl ?? null;
}

function EventDetailPage() {
  const { id } = useParams({ from: "/events/$id" });
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventWithMeta | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  const refresh = async () => {
    try {
      const [e, a] = await Promise.all([getEvent(id), listEventAttendees(id)]);
      if (!e) {
        toast.error("Event not found");
        navigate({ to: "/events" });
        return;
      }
      setEvent(e);
      const signed = await Promise.all(
        a.map(async (x) => ({ ...x, photo: await signPhoto(x.photo) })),
      );
      setAttendees(signed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    refresh();
  }, [user, id]);

  const handleRsvp = async (status: RsvpStatus) => {
    if (!event) return;
    setSaving(true);
    try {
      const next = event.my_rsvp === status ? null : status;
      await setRsvp(event.id, next);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update RSVP");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!confirm("Delete this event?")) return;
    try {
      await deleteEvent(event.id);
      toast.success("Event deleted");
      navigate({ to: "/events" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  };

  if (loading || !event) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const isHost = user?.id === event.host_id;
  const full =
    event.max_attendees != null &&
    event.going_count >= event.max_attendees &&
    event.my_rsvp !== "going";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-3 py-3 backdrop-blur">
        <Link to="/events" className="rounded-full p-2 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="line-clamp-1 text-base font-semibold tracking-tight">{event.title}</h1>
        {isHost && (
          <button
            onClick={handleDelete}
            className="ml-auto rounded-full p-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <div className="px-3 py-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-primary">
              {eventTypeLabel(event.event_type)}
            </span>
            {event.host_name && (
              <span className="text-xs text-muted-foreground">hosted by {event.host_name}</span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold">{event.title}</h2>

          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-primary/70" />
              {formatEventDate(event.starts_at)}
              {event.ends_at ? ` → ${formatEventDate(event.ends_at)}` : ""}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-primary/70" />
              {event.city}
              {event.venue ? ` · ${event.venue}` : ""}
            </li>
            <li className="flex items-center gap-2">
              <Users className="size-4 text-primary/70" />
              {event.going_count} going{event.max_attendees ? ` / ${event.max_attendees}` : ""}
              {event.interested_count > 0 && ` · ${event.interested_count} interested`}
            </li>
          </ul>

          {event.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-foreground/90">
              {event.description}
            </p>
          )}
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Attendees</h3>
          {attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one yet — be the first.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2">
              {attendees.map((a) => (
                <li key={a.user_id} className="text-center">
                  <div className="relative mx-auto size-14 overflow-hidden rounded-full bg-muted">
                    {a.photo ? (
                      <img src={a.photo} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-lg text-muted-foreground/40">
                        {(a.display_name ?? "?").slice(0, 1)}
                      </div>
                    )}
                    {a.status === "interested" && (
                      <span className="absolute inset-0 rounded-full ring-2 ring-amber-400/70" />
                    )}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {a.display_name ?? "Unknown"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!isHost && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md px-3 pb-2">
          <div className="flex gap-2 rounded-full border border-border bg-background/95 p-1 shadow-lg backdrop-blur">
            <button
              disabled={saving || full}
              onClick={() => handleRsvp("going")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${event.my_rsvp === "going" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
            >
              {event.my_rsvp === "going" ? "✓ Going" : full ? "Full" : "Going"}
            </button>
            <button
              disabled={saving}
              onClick={() => handleRsvp("interested")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${event.my_rsvp === "interested" ? "bg-amber-400/20 text-amber-300" : "text-foreground hover:bg-muted"}`}
            >
              {event.my_rsvp === "interested" ? "✓ Interested" : "Interested"}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
