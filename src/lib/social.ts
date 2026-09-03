import { supabase } from "@/integrations/supabase/client";
import { fetchProfilesChunked } from "@/lib/profile-rpc";

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
  // Notificarea și push-ul sunt create exclusiv de triggerul DB `taps_notify`.
  // Clientul nu trimite push-uri: astfel rămân active gate-urile, preferințele
  // și corpul generic impuse server-side.
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
  profile_slug: string | null;
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
  // `list_visible_profiles` exclude blocurile (ambele direcții) și profilurile
  // în incognito → favoritul dispare din listă, nu rămâne ca „Anonim".
  const profs = await fetchProfilesChunked("list_visible_profiles", ids);

  const map = new Map<
    string,
    { display_name: string | null; photos: string[] | null; last_seen: string | null; profile_slug: string | null }
  >();
  (profs ?? []).forEach((p: unknown) =>
    map.set((p as { id: string }).id, {
      display_name: (p as { display_name: string | null }).display_name,
      photos: (p as { photos: string[] | null }).photos,
      last_seen: (p as { last_seen: string | null; profile_slug: string | null }).last_seen,
      profile_slug: (p as { profile_slug: string | null }).profile_slug || (p as { id: string }).id,
    }),
  );
  return (favs ?? [])
    .filter((f) => map.has(f.favorite_id))
    .map((f) => ({
      favorite_id: f.favorite_id,
      created_at: f.created_at,
      ...map.get(f.favorite_id)!,
    }));
}

export async function setLookingNow(hours: number, intent?: string) {
  // Semnătura unică rămasă este `set_looking_now(_intent text, _hours integer)`
  // (cea veche, fără age gate, a fost eliminată). Ambele argumente sunt
  // obligatorii — trimitem `null` explicit, nu `undefined`.
  const { error } = await supabase.rpc("set_looking_now", {
    _intent: intent ?? null,
    _hours: hours,
  } as never);
  if (error) throw error;
}


export async function toggleMessageReaction(messageId: string, emoji: ReactionEmoji) {
  const { data, error } = await supabase.rpc("toggle_message_reaction", {
    _msg_id: messageId,
    _emoji: emoji,
  });
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
  // `get_public_profiles` filtrează acum blocările în ambele direcții, deci lista
  // de utilizatori blocați are RPC propriu (owner-only, minim de câmpuri).
  const { data, error } = await (supabase.rpc as any)("list_my_blocked_profiles");
  if (error) throw error;
  return ((data ?? []) as Array<{
    blocked_id: string;
    created_at: string;
    display_name: string | null;
    photos: string[] | null;
  }>).map((r) => ({
    blocked_id: r.blocked_id,
    created_at: r.created_at,
    display_name: r.display_name ?? null,
    photos: r.photos ?? null,
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
  // La deblocare persoana trebuie să REAPARĂ imediat în grilă și în inbox.
  const { emitBlocksChanged } = await import("@/lib/block-events");
  await emitBlocksChanged();
}
