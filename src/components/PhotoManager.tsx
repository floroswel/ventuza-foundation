import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Star, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { moderatePhoto } from "@/lib/verification.functions";
import { cn } from "@/lib/utils";
import { computePhash } from "@/lib/phash";

const MAX_PHOTOS = 9;
const MAX_SIZE_MB = 8;

type Props = {
  userId: string;
  photos: string[];
  onChange: (next: string[]) => void;
  persist?: boolean; // if true, writes to profiles.photos on every change
  className?: string;
};

export function PhotoManager({ userId, photos, onChange, persist = true, className }: Props) {
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const moderate = useServerFn(moderatePhoto);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const p of photos) {
        if (p.startsWith("http")) { out[p] = p; continue; }
        const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
        if (data?.signedUrl) out[p] = data.signedUrl;
      }
      if (!cancelled) setSigned(out);
    })();
    return () => { cancelled = true; };
  }, [photos]);

  async function savePhotos(next: string[]) {
    onChange(next);
    if (!persist) return;
    const { error } = await supabase.from("profiles").update({ photos: next }).eq("id", userId);
    if (error) toast.error(error.message);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { toast.error(`You already have ${MAX_PHOTOS} photos.`); return; }
    const list = Array.from(files).slice(0, room);
    setBusy(true);
    const added: string[] = [];
    try {
      for (const file of list) {
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          toast.error(`${file.name} is over ${MAX_SIZE_MB}MB.`);
          continue;
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("profile-photos")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (error) { toast.error(error.message); continue; }

        // AI moderation pass — best effort, don't block on failure
        try {
          const { data: signedData } = await supabase.storage.from("profile-photos").createSignedUrl(path, 300);
          if (signedData?.signedUrl) {
            const mod = await moderate({ data: { photoUrl: signedData.signedUrl } });
            if (!mod.allowed) {
              await supabase.storage.from("profile-photos").remove([path]);
              toast.error(`Poza respinsă: ${mod.reason || "conținut nepermis"}`);
              continue;
            }
          }
        } catch {
          // moderation failure shouldn't block upload
        }

        // Perceptual hash → server (catfishing detection)
        try {
          const phash = await computePhash(file);
          if (phash) await supabase.rpc("record_photo_hash", { _path: path, _phash: phash });
        } catch {
          // non-blocking
        }

        added.push(path);
      }
      if (added.length) {
        await savePhotos([...photos, ...added]);
        toast.success(`${added.length} photo${added.length > 1 ? "s" : ""} uploaded.`);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(path: string) {
    if (!path.startsWith("http")) {
      await supabase.storage.from("profile-photos").remove([path]);
    }
    await savePhotos(photos.filter((p) => p !== path));
  }

  async function makePrimary(path: string) {
    if (photos[0] === path) return;
    await savePhotos([path, ...photos.filter((p) => p !== path)]);
  }

  async function move(path: string, dir: -1 | 1) {
    const i = photos.indexOf(path);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    await savePhotos(next);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Photos · {photos.length}/{MAX_PHOTOS}
        </p>
        <p className="text-[10px] text-muted-foreground">Tap ★ to set main · ◂ ▸ to reorder</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div
            key={p}
            className={cn(
              "group relative aspect-[3/4] overflow-hidden rounded-xl border bg-muted",
              i === 0 ? "border-primary/60" : "border-border",
            )}
          >
            {signed[p] ? (
              <img src={signed[p]} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary-foreground">
                Main
              </span>
            )}
            <button
              onClick={() => remove(p)}
              aria-label="Remove"
              className="absolute right-1.5 top-1.5 rounded-full bg-background/85 p-1 text-foreground backdrop-blur hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="size-3" />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/70 px-1 py-1 backdrop-blur">
              <button
                onClick={() => move(p, -1)}
                disabled={i === 0}
                aria-label="Move left"
                className="rounded p-1 text-foreground/80 hover:text-primary disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                onClick={() => makePrimary(p)}
                aria-label="Set as main"
                className={cn(
                  "rounded p-1",
                  i === 0 ? "text-primary" : "text-foreground/70 hover:text-primary",
                )}
              >
                <Star className={cn("size-3.5", i === 0 && "fill-primary")} />
              </button>
              <button
                onClick={() => move(p, 1)}
                disabled={i === photos.length - 1}
                aria-label="Move right"
                className="rounded p-1 text-foreground/80 hover:text-primary disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-background/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
            <span className="text-[10px] uppercase tracking-wider">Add</span>
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
