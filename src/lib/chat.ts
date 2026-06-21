import { supabase } from "@/integrations/supabase/client";

export type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
  last_message_preview: string | null;
};

export type MessageMediaType = "text" | "image" | "audio" | "location";

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  reactions?: Record<string, string[]> | null;
  media_type?: MessageMediaType | null;
  media_url?: string | null;
  audio_duration_ms?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  view_once?: boolean | null;
  expires_at?: string | null;
  viewed_at?: string | null;
  reply_to_id?: string | null;
  deleted_at?: string | null;
};

export type ConversationListItem = {
  id: string;
  other_id: string;
  other_name: string | null;
  other_photo: string | null;
  last_message_preview: string | null;
  last_message_at: string;
  unread: boolean;
};

async function signPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data } = await supabase.storage.from("profile-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_conversation", { _other: otherUserId });
  if (error) throw error;
  return data as string;
}

export async function fetchConversations(meId: string): Promise<ConversationListItem[]> {
  const { data: convs, error } = await supabase
    .from("conversations")
    .select("id, user_a, user_b, last_message_at, last_message_preview")
    .or(`user_a.eq.${meId},user_b.eq.${meId}`)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  const rows = (convs ?? []) as ConversationRow[];
  if (rows.length === 0) return [];

  const otherIds = Array.from(new Set(rows.map((r) => (r.user_a === meId ? r.user_b : r.user_a))));
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, photos")
    .in("id", otherIds);
  const map = new Map<string, { name: string | null; photo: string | null }>();
  for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null; photos: string[] | null }>) {
    map.set(p.id, { name: p.display_name, photo: await signPhoto(p.photos?.[0] ?? null) });
  }

  // Unread: any message in conv where sender != me and read_at IS NULL
  const { data: unread } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", rows.map((r) => r.id))
    .neq("sender_id", meId)
    .is("read_at", null);
  const unreadSet = new Set<string>((unread ?? []).map((u: { conversation_id: string }) => u.conversation_id));

  return rows.map((r) => {
    const oid = r.user_a === meId ? r.user_b : r.user_a;
    const info = map.get(oid);
    return {
      id: r.id,
      other_id: oid,
      other_name: info?.name ?? null,
      other_photo: info?.photo ?? null,
      last_message_preview: r.last_message_preview,
      last_message_at: r.last_message_at,
      unread: unreadSet.has(r.id),
    };
  });
}

export const MESSAGES_PAGE = 30;

export async function fetchMessages(
  conversationId: string,
  opts: { before?: string; limit?: number } = {},
): Promise<MessageRow[]> {
  const limit = opts.limit ?? MESSAGES_PAGE;
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).slice().reverse();
}

export async function sendMessage(conversationId: string, body: string, replyToId?: string | null): Promise<MessageRow> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("empty");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const insert: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: u.user.id,
    body: trimmed.slice(0, 4000),
    media_type: "text",
  };
  if (replyToId) insert.reply_to_id = replyToId;
  const { data, error } = await supabase
    .from("messages")
    .insert(insert as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageRow;
}

export async function unsendMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc("unsend_message", { _message_id: messageId } as never);
  if (error) throw error;
}

export async function markRead(conversationId: string, meId: string): Promise<void> {
  // Respect the recipient's "read receipts" preference: if I have it OFF, don't stamp read_at
  const { data: meProf } = await supabase
    .from("profiles")
    .select("read_receipts_enabled")
    .eq("id", meId)
    .maybeSingle();
  if (meProf && (meProf as { read_receipts_enabled?: boolean }).read_receipts_enabled === false) return;
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", meId)
    .is("read_at", null);
}

export type MediaPayload =
  | { kind: "image"; file: Blob; viewOnce?: boolean }
  | { kind: "audio"; file: Blob; durationMs: number }
  | { kind: "location"; lat: number; lng: number; label?: string };

export async function sendMediaMessage(conversationId: string, payload: MediaPayload): Promise<MessageRow> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const uid = u.user.id;

  let insert: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: uid,
    body: "",
  };

  if (payload.kind === "location") {
    insert = {
      ...insert,
      media_type: "location",
      location_lat: payload.lat,
      location_lng: payload.lng,
      body: payload.label ?? "📍 Location",
    };
  } else {
    const ext = payload.kind === "image" ? "jpg" : "webm";
    const path = `${uid}/${conversationId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, payload.file, { contentType: payload.file.type || (payload.kind === "image" ? "image/jpeg" : "audio/webm"), upsert: false });
    if (upErr) throw upErr;
    insert = {
      ...insert,
      media_type: payload.kind,
      media_url: path,
      body: payload.kind === "image" ? "📷 Photo" : "🎤 Voice message",
    };
    if (payload.kind === "audio") insert.audio_duration_ms = Math.round(payload.durationMs);
    if (payload.kind === "image" && payload.viewOnce) insert.view_once = true;
  }

  const { data, error } = await supabase.from("messages").insert(insert as never).select("*").single();
  if (error) throw error;
  return data as MessageRow;
}

export async function signChatMedia(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function markMediaViewed(messageId: string): Promise<void> {
  await supabase.from("messages").update({ viewed_at: new Date().toISOString() }).eq("id", messageId);
}

export async function markRead(conversationId: string, meId: string): Promise<void> {
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", meId)
    .is("read_at", null);
}

export async function fetchOtherProfile(otherId: string): Promise<{ id: string; name: string | null; photo: string | null }> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, photos")
    .eq("id", otherId)
    .maybeSingle();
  const row = data as { display_name: string | null; photos: string[] | null } | null;
  return {
    id: otherId,
    name: row?.display_name ?? null,
    photo: await signPhoto(row?.photos?.[0] ?? null),
  };
}
