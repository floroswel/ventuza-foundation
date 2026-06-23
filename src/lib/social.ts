import { supabase } from "@/integrations/supabase/client";

export const TAP_EMOJIS = ["👋", "🔥", "😈", "👀", "💋", "🍆"] as const;
export type TapEmoji = (typeof TAP_EMOJIS)[number];

export const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👍"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export async function sendTap(receiverId: string, emoji: TapEmoji) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const { error } = await supabase
    .from("taps")
    .insert({ sender_id: u.user.id, receiver_id: receiverId, emoji });
  if (error) throw error;
}

export async function addFavorite(targetId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: u.user.id, favorite_id: targetId });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function removeFavorite(targetId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", u.user.id)
    .eq("favorite_id", targetId);
  if (error) throw error;
}

export async function isFavorite(targetId: string): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", u.user.id)
    .eq("favorite_id", targetId)
    .maybeSingle();
  return !!data;
}

export type FavoriteRow = {
  favorite_id: string;
  created_at: string;
  display_name: string | null;
  photos: string[] | null;
  last_seen: string | null;
};

export async function listFavorites(): Promise<FavoriteRow[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data: favs, error } = await supabase
    .from("favorites")
    .select("favorite_id, created_at")
    .eq("user_id", u.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (favs ?? []).map((f) => f.favorite_id);
  if (!ids.length) return [];
  const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: ids });
  const map = new Map<string, { display_name: string | null; photos: string[] | null; last_seen: string | null }>();
  (profs ?? []).forEach((p) =>
    map.set((p as { id: string }).id, {
      display_name: (p as { display_name: string | null }).display_name,
      photos: (p as { photos: string[] | null }).photos,
      last_seen: (p as { last_seen: string | null }).last_seen,
    }),
  );
  return (favs ?? []).map((f) => ({
    favorite_id: f.favorite_id,
    created_at: f.created_at,
    ...(map.get(f.favorite_id) ?? { display_name: null, photos: null, last_seen: null }),
  }));
}

export async function setLookingNow(hours: number, intent?: string) {
  const { error } = await supabase.rpc("set_looking_now", { _hours: hours, _intent: intent ?? undefined });
  if (error) throw error;
}

export async function toggleMessageReaction(messageId: string, emoji: ReactionEmoji) {
  const { data, error } = await supabase.rpc("toggle_message_reaction", { _msg_id: messageId, _emoji: emoji });
  if (error) throw error;
  return data as Record<string, string[]>;
}

export type BlockedUser = {
  blocked_id: string;
  created_at: string;
  display_name: string | null;
  photos: string[] | null;
};

export async function listBlocked(): Promise<BlockedUser[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data: bls, error } = await supabase
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", u.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (bls ?? []).map((b) => b.blocked_id);
  if (!ids.length) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, photos")
    .in("id", ids);
  const map = new Map<string, { display_name: string | null; photos: string[] | null }>();
  (profs ?? []).forEach((p) =>
    map.set(p.id as string, {
      display_name: (p as { display_name: string | null }).display_name,
      photos: (p as { photos: string[] | null }).photos,
    }),
  );
  return (bls ?? []).map((b) => ({
    blocked_id: b.blocked_id,
    created_at: b.created_at,
    ...(map.get(b.blocked_id) ?? { display_name: null, photos: null }),
  }));
}

export async function unblock(targetId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", u.user.id)
    .eq("blocked_id", targetId);
  if (error) throw error;
}
