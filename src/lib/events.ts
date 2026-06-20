import { supabase } from "@/integrations/supabase/client";

export type EventType = "party" | "bar" | "pride" | "private" | "meetup" | "other";
export type RsvpStatus = "going" | "interested";

export type EventRow = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  city: string;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string;
  ends_at: string | null;
  max_attendees: number | null;
  cover_url: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
};

export type EventWithMeta = EventRow & {
  host_name: string | null;
  going_count: number;
  interested_count: number;
  my_rsvp: RsvpStatus | null;
};

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  party: "Party",
  bar: "Bar",
  pride: "Pride",
  private: "Private",
  meetup: "Meetup",
  other: "Other",
};

export function eventTypeLabel(t: EventType) {
  return EVENT_TYPE_LABEL[t] ?? t;
}

export async function listUpcomingEvents(opts?: { city?: string; type?: EventType | "all" }): Promise<EventWithMeta[]> {
  const nowIso = new Date().toISOString();
  let q = supabase
    .from("events")
    .select("*")
    .eq("is_private", false)
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(100);
  if (opts?.city && opts.city.trim()) q = q.ilike("city", `%${opts.city.trim()}%`);
  if (opts?.type && opts.type !== "all") q = q.eq("event_type", opts.type);

  const { data: events, error } = await q;
  if (error) throw error;
  const rows = (events ?? []) as EventRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const hostIds = Array.from(new Set(rows.map((r) => r.host_id)));

  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("event_id, user_id, status")
    .in("event_id", ids);

  const { data: hosts } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", hostIds);

  const hostMap = new Map<string, string | null>();
  for (const h of (hosts ?? []) as Array<{ id: string; display_name: string | null }>) {
    hostMap.set(h.id, h.display_name);
  }

  const { data: me } = await supabase.auth.getUser();
  const myId = me.user?.id ?? null;

  const goingCount = new Map<string, number>();
  const interestedCount = new Map<string, number>();
  const myMap = new Map<string, RsvpStatus>();
  for (const r of (rsvps ?? []) as Array<{ event_id: string; user_id: string; status: RsvpStatus }>) {
    if (r.status === "going") goingCount.set(r.event_id, (goingCount.get(r.event_id) ?? 0) + 1);
    else interestedCount.set(r.event_id, (interestedCount.get(r.event_id) ?? 0) + 1);
    if (myId && r.user_id === myId) myMap.set(r.event_id, r.status);
  }

  return rows.map((r) => ({
    ...r,
    host_name: hostMap.get(r.host_id) ?? null,
    going_count: goingCount.get(r.id) ?? 0,
    interested_count: interestedCount.get(r.id) ?? 0,
    my_rsvp: myMap.get(r.id) ?? null,
  }));
}

export async function getEvent(id: string): Promise<EventWithMeta | null> {
  const { data: e, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!e) return null;
  const ev = e as EventRow;

  const [{ data: rsvps }, { data: host }, { data: me }] = await Promise.all([
    supabase.from("event_rsvps").select("user_id, status").eq("event_id", id),
    supabase.from("profiles").select("display_name").eq("id", ev.host_id).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const myId = me.user?.id ?? null;
  let going = 0, interested = 0;
  let my: RsvpStatus | null = null;
  for (const r of (rsvps ?? []) as Array<{ user_id: string; status: RsvpStatus }>) {
    if (r.status === "going") going++;
    else interested++;
    if (myId && r.user_id === myId) my = r.status;
  }

  return {
    ...ev,
    host_name: (host as { display_name: string | null } | null)?.display_name ?? null,
    going_count: going,
    interested_count: interested,
    my_rsvp: my,
  };
}

export async function listEventAttendees(eventId: string) {
  const { data: rsvps, error } = await supabase
    .from("event_rsvps")
    .select("user_id, status, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (rsvps ?? []) as Array<{ user_id: string; status: RsvpStatus; created_at: string }>;
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.user_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, photos")
    .in("id", ids);
  const map = new Map<string, { display_name: string | null; photos: string[] | null }>();
  for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null; photos: string[] | null }>) {
    map.set(p.id, p);
  }
  return rows.map((r) => ({
    user_id: r.user_id,
    status: r.status,
    display_name: map.get(r.user_id)?.display_name ?? null,
    photo: map.get(r.user_id)?.photos?.[0] ?? null,
  }));
}

export async function setRsvp(eventId: string, status: RsvpStatus | null) {
  const { data: me } = await supabase.auth.getUser();
  const uid = me.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (status === null) {
    const { error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", uid);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("event_rsvps")
    .upsert({ event_id: eventId, user_id: uid, status }, { onConflict: "event_id,user_id" });
  if (error) throw error;
}

export type CreateEventInput = {
  title: string;
  description?: string | null;
  event_type: EventType;
  city: string;
  venue?: string | null;
  starts_at: string;
  ends_at?: string | null;
  max_attendees?: number | null;
  is_private?: boolean;
};

export async function createEvent(input: CreateEventInput): Promise<string> {
  const { data: me } = await supabase.auth.getUser();
  const uid = me.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("events")
    .insert({
      host_id: uid,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      event_type: input.event_type,
      city: input.city.trim(),
      venue: input.venue?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at || null,
      max_attendees: input.max_attendees ?? null,
      is_private: !!input.is_private,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export function formatEventDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
