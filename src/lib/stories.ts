import { supabase } from "@/integrations/supabase/client";
import { moderatePhoto } from "@/lib/verification.functions";

export type Story = {
  id: string;
  user_id: string;
  media_path: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
};

export type StoryGroup = {
  user_id: string;
  display_name: string | null;
  photos: string[] | null;
  stories: Story[];
  hasUnseen: boolean;
};

const STORIES_BUCKET = "stories";

export async function uploadStory(file: File, caption?: string): Promise<Story> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  if (file.size > 12 * 1024 * 1024) throw new Error("Fișierul depășește 12 MB.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(STORIES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (upErr) throw upErr;

  // Moderare AI obligatorie pentru poze din story (conținut public).
  // Doar imagini — video-urile trec (nu avem moderare video încă).
  const isImage = (file.type || "").startsWith("image/");
  if (isImage) {
    try {
      const { data: signedData } = await supabase.storage.from(STORIES_BUCKET).createSignedUrl(path, 300);
      if (signedData?.signedUrl) {
        const mod = await moderatePhoto({ data: { photoUrl: signedData.signedUrl } });
        if (!mod.allowed) {
          await supabase.storage.from(STORIES_BUCKET).remove([path]);
          throw new Error(
            `Story respins: ${mod.reason || "conținut nepermis public"}. Pozele nud/explicite sunt permise doar în Albumul privat.`,
          );
        }
      }
    } catch (e) {
      // dacă e eroarea noastră de respingere, propagăm
      if ((e as Error).message?.startsWith("Story respins")) throw e;
      // altfel: ștergem și cerem retry — safety first
      await supabase.storage.from(STORIES_BUCKET).remove([path]);
      throw new Error(`Nu am putut verifica story-ul: ${(e as Error).message}. Încearcă din nou.`);
    }
  }

  const { data, error } = await supabase
    .from("stories")
    .insert({ user_id: u.user.id, media_path: path, caption: caption ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as Story;
}


export async function deleteStory(id: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const { data: story } = await supabase.from("stories").select("media_path").eq("id", id).maybeSingle();
  if (story?.media_path) await supabase.storage.from(STORIES_BUCKET).remove([story.media_path]);
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchActiveStoryGroups(): Promise<StoryGroup[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];

  const { data: rows, error } = await supabase
    .from("stories")
    .select("id, user_id, media_path, caption, created_at, expires_at, view_count")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;
  const stories = (rows ?? []) as Story[];
  if (!stories.length) return [];

  const userIds = Array.from(new Set(stories.map((s) => s.user_id)));
  const [{ data: profs }, { data: seenRows }] = await Promise.all([
    supabase.rpc("get_public_profiles", { _ids: userIds }),
    supabase.from("story_views").select("story_id").eq("viewer_id", u.user.id).in("story_id", stories.map((s) => s.id)),
  ]);
  const profMap = new Map<string, { display_name: string | null; photos: string[] | null }>();
  (profs ?? []).forEach((p) =>
    profMap.set((p as { id: string }).id, {
      display_name: (p as { display_name: string | null }).display_name,
      photos: (p as { photos: string[] | null }).photos,
    }),
  );
  const seenSet = new Set((seenRows ?? []).map((r) => r.story_id as string));

  const grouped = new Map<string, StoryGroup>();
  for (const s of stories) {
    const meta = profMap.get(s.user_id) ?? { display_name: null, photos: null };
    let g = grouped.get(s.user_id);
    if (!g) {
      g = { user_id: s.user_id, display_name: meta.display_name, photos: meta.photos, stories: [], hasUnseen: false };
      grouped.set(s.user_id, g);
    }
    g.stories.push(s);
    if (!seenSet.has(s.id)) g.hasUnseen = true;
  }

  // own user first, then groups with unseen, then rest by latest story desc
  const list = Array.from(grouped.values()).sort((a, b) => {
    if (a.user_id === u.user!.id) return -1;
    if (b.user_id === u.user!.id) return 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    const aLast = new Date(a.stories[a.stories.length - 1].created_at).getTime();
    const bLast = new Date(b.stories[b.stories.length - 1].created_at).getTime();
    return bLast - aLast;
  });
  return list;
}

export async function signStoryMedia(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      const { data } = await supabase.storage.from(STORIES_BUCKET).createSignedUrl(p, 3600);
      if (data?.signedUrl) out[p] = data.signedUrl;
    }),
  );
  return out;
}

export async function markStorySeen(storyId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("story_views").insert({ story_id: storyId, viewer_id: u.user.id }).select().maybeSingle();
}
