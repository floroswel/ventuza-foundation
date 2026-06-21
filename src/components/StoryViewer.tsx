import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteStory, markStorySeen, signStoryMedia, type StoryGroup } from "@/lib/stories";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const STORY_DURATION_MS = 5000;

export function StoryViewer({
  groups,
  startIndex,
  onClose,
  onChanged,
}: {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const tickRef = useRef<number | null>(null);

  const group = groups[gi];
  const story = group?.stories[si];

  // load media + mark seen
  useEffect(() => {
    if (!story) return;
    setMediaUrl(null);
    setProgress(0);
    signStoryMedia([story.media_path]).then((m) => setMediaUrl(m[story.media_path] ?? null));
    void markStorySeen(story.id);
  }, [story?.id]);

  // tick progress
  useEffect(() => {
    if (!story || paused) return;
    const start = Date.now() - progress * STORY_DURATION_MS;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / STORY_DURATION_MS, 1);
      setProgress(p);
      if (p >= 1) {
        window.clearInterval(id);
        next();
      }
    }, 50);
    tickRef.current = id;
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  function next() {
    if (!group) return;
    if (si + 1 < group.stories.length) setSi(si + 1);
    else if (gi + 1 < groups.length) { setGi(gi + 1); setSi(0); }
    else onClose();
  }
  function prev() {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].stories.length - 1); }
  }

  async function handleDelete() {
    if (!story) return;
    if (!confirm("Ștergi acest story?")) return;
    try {
      await deleteStory(story.id);
      toast.success("Șters");
      onChanged?.();
      next();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!story || !group) return null;
  const isMine = group.user_id === user?.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* Top bars */}
      <div className="absolute inset-x-0 top-0 z-10 p-3">
        <div className="flex gap-1">
          {group.stories.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white"
                style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{isMine ? "Tu" : group.display_name ?? "—"}</span>
            <span className="text-[10px] text-white/60">
              {Math.round((Date.now() - new Date(story.created_at).getTime()) / 60000)}m
            </span>
            {isMine && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                👁 {story.view_count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMine && (
              <button onClick={handleDelete} aria-label="Șterge" className="rounded-full bg-white/10 p-1.5">
                <Trash2 className="size-4" />
              </button>
            )}
            <button onClick={onClose} aria-label="Închide" className="rounded-full bg-white/10 p-1.5">
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Media */}
      <div className="relative size-full max-w-md">
        {mediaUrl ? (
          <img src={mediaUrl} alt="" className="size-full object-contain" />
        ) : (
          <div className="grid size-full place-items-center text-white/60">Se încarcă…</div>
        )}
        {story.caption && (
          <p className={cn(
            "absolute inset-x-6 bottom-20 rounded-xl bg-black/55 px-3 py-2 text-center text-sm text-white backdrop-blur",
          )}>{story.caption}</p>
        )}

        {/* Tap zones */}
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-0 top-0 h-full w-1/3"
          aria-label="Înapoi"
        ><ChevronLeft className="absolute left-2 top-1/2 -translate-y-1/2 size-6 text-white/40" /></button>
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-0 top-0 h-full w-1/3"
          aria-label="Următorul"
        ><ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 size-6 text-white/40" /></button>
      </div>
    </div>
  );
}
