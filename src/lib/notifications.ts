import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "match"
  | "message"
  | "profile_view"
  | "album_request"
  | "album_granted"
  | "event_rsvp"
  | "event_reminder"
  | "tap"
  | "like"
  | "favorite"
  | "admin_message"
  | "partner_broadcast";

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Clopoțelul păstrează DOAR notificările „de sistem": mesaje de la echipă,
 * rezultatul rapoartelor/moderării, oferte și anunțuri de la parteneri, cereri
 * de acces la albume private și evenimente.
 *
 * Interacțiunile sociale (match, tap, like, favorite, vizite) NU mai apar în
 * clopoțel — ele trăiesc în ecranul Potriviri (tab-urile Potriviri / Vizite /
 * Tap-uri / Favoriți). Mesajele trăiesc în tab-ul Mesaje.
 */
export const BELL_TYPES: NotificationType[] = [
  "admin_message",
  "partner_broadcast",
  "album_request",
  "album_granted",
  "event_rsvp",
  "event_reminder",
];


export async function listNotifications(limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .in("type", BELL_TYPES)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function unreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .in("type", BELL_TYPES)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export async function markAllRead() {
  const { data: me } = await supabase.auth.getUser();
  const uid = me.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid)
    .in("type", BELL_TYPES)
    .is("read_at", null);
  if (error) throw error;
}


export async function deleteNotification(id: string) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}
