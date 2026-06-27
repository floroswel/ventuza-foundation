import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createEvent, eventTypeLabel, type EventType } from "@/lib/events";

const TYPES: EventType[] = ["party", "bar", "pride", "meetup", "private", "other"];

function toLocalInputValue(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<EventType>("party");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [maxAttendees, setMaxAttendees] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setTitle(""); setDescription(""); setType("party"); setCity(""); setVenue("");
    setStartsAt(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    setMaxAttendees(""); setIsPrivate(false);
  };

  const submit = async () => {
    if (!title.trim() || !city.trim() || !startsAt) {
      toast.error("Title, city, and start time are required");
      return;
    }
    setSaving(true);
    try {
      const id = await createEvent({
        title,
        description,
        event_type: type,
        city,
        venue,
        starts_at: new Date(startsAt).toISOString(),
        max_attendees: maxAttendees ? Math.max(1, parseInt(maxAttendees, 10)) : null,
        is_private: isPrivate,
      });
      toast.success("Event created");
      reset();
      onCreated(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-background sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-base font-semibold">Propune un eveniment</h2>
          <button onClick={() => onOpenChange(false)} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-4">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer Pride party" className={inputCls} />
          </Field>

          <Field label="Type">
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-full px-3 py-1 text-xs transition ${type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {eventTypeLabel(t)}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bucharest" className={inputCls} />
            </Field>
            <Field label="Venue (optional)">
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Club X" className={inputCls} />
            </Field>
          </div>

          <Field label="Starts at">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Max attendees (optional)">
            <input type="number" min={1} value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} placeholder="No limit" className={inputCls} />
          </Field>

          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Dress code, vibe, address details…" className={`${inputCls} resize-none`} />
          </Field>

          <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="size-4 accent-primary" />
            <span>Private — only I can see this event</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
          <button onClick={() => onOpenChange(false)} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
