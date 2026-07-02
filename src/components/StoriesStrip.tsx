import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  fetchActiveStoryGroups,
  signStoryMedia,
  uploadStory,
  type StoryGroup,
} from "@/lib/stories";
import { signPhotos } from "@/lib/discover";
import { useAuth } from "@/lib/auth-context";
import { StoryViewer } from "@/components/StoryViewer";
import { cn } from "@/lib/utils";

export function StoriesStrip() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [storyPreviews, setStoryPreviews] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    try {
      const g = await fetchActiveStoryGroups();
      setGroups(g);
      const avatarPaths = g.map((x) => x.photos?.[0]).filter(Boolean) as string[];
      if (avatarPaths.length) setAvatarUrls(await signPhotos(avatarPaths));
      const previewPaths = g.map((x) => x.stories[0]?.media_path).filter(Boolean) as string[];
      if (previewPaths.length) setStoryPreviews(await signStoryMedia(previewPaths));
    } catch (e) {
      console.warn("stories load", e);
    }
  };

  useEffect(() => {
    if (!user) return;
    void reload();
  }, [user]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      await uploadStory(f);
      toast.success("Story publicat");
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const ownGroup = groups.find((g) => g.user_id === user?.id);
  const others = groups.filter((g) => g.user_id !== user?.id);
  const ordered = ownGroup ? [ownGroup, ...others] : others;

  if (!user) return null;

  return (
    <div className="border-b border-border/40 px-3 py-3">
      <input ref={fileRef} type="file" accept="image/*,video/mp4" hidden onChange={handleUpload} />
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Add button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group flex shrink-0 flex-col items-center gap-1"
          aria-label="Adaugă story"
        >
          <span className="relative grid size-[66px] place-items-center rounded-full border border-dashed border-primary/60 bg-surface text-primary">
            {ownGroup ? (
              <img
                src={ownGroup.photos?.[0] ? avatarUrls[ownGroup.photos[0]] : ""}
                alt=""
                className="size-full rounded-full object-cover opacity-80"
              />
            ) : null}
            <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Plus className="size-3.5" strokeWidth={3} />
            </span>
          </span>
          <span className="text-[10px] text-foreground/80">
            {ownGroup ? "Adaugă" : "Story nou"}
          </span>
        </button>

        {ordered.map((g, idx) => {
          const avatar = g.photos?.[0] ? avatarUrls[g.photos[0]] : null;
          const preview = g.stories[0]?.media_path ? storyPreviews[g.stories[0].media_path] : null;
          const isMe = g.user_id === user.id;
          return (
            <button
              key={g.user_id}
              onClick={() => setViewerIndex(idx)}
              className="group flex shrink-0 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "block size-[66px] rounded-full p-[2px]",
                  g.hasUnseen && !isMe
                    ? "bg-gradient-to-tr from-primary via-primary-glow to-primary glow-gold"
                    : "bg-muted",
                )}
              >
                <span className="block size-full overflow-hidden rounded-full bg-surface ring-2 ring-background">
                  {preview ? (
                    <img src={preview} alt="" className="size-full object-cover" />
                  ) : avatar ? (
                    <img src={avatar} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-base text-muted-foreground/60">
                      {g.display_name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}
                </span>
              </span>
              <span className="max-w-[68px] truncate text-[10px] text-foreground/80">
                {isMe ? "Tu" : (g.display_name ?? "—")}
              </span>
            </button>
          );
        })}
      </div>

      {viewerIndex !== null && ordered[viewerIndex] && (
        <StoryViewer
          groups={ordered}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
