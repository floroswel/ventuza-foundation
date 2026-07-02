import { useEffect, useRef, useState } from "react";
import { Video, Trash2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MAX_SEC = 15;
const MAX_MB = 25;

type Props = {
  userId: string;
  videoPath: string | null;
  onChange: (path: string | null) => void;
};

export function VideoClipCard({ userId, videoPath, onChange }: Props) {
  const [signed, setSigned] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!videoPath) {
      setSigned(null);
      return;
    }
    (async () => {
      const { data } = await supabase.storage
        .from("profile-media")
        .createSignedUrl(videoPath, 3600);
      if (data?.signedUrl) setSigned(data.signedUrl);
    })();
  }, [videoPath]);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Maxim ${MAX_MB}MB.`);
      return;
    }
    // duration check
    const dur = await new Promise<number>((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => resolve(v.duration || 0);
      v.onerror = () => resolve(0);
      v.src = URL.createObjectURL(file);
    });
    if (dur && dur > MAX_SEC + 1) {
      toast.error(`Maxim ${MAX_SEC} secunde. Clipul tău are ${Math.round(dur)}s.`);
      return;
    }

    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${userId}/video-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("profile-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      if (videoPath) await supabase.storage.from("profile-media").remove([videoPath]);

      const { error } = await supabase
        .from("profiles")
        .update({ video_clip_path: path })
        .eq("id", userId);
      if (error) throw error;
      onChange(path);
      toast.success("Clip salvat.");
    } catch (e: any) {
      toast.error(e.message || "Upload eșuat");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (!videoPath) return;
    setBusy(true);
    await supabase.storage.from("profile-media").remove([videoPath]);
    const { error } = await supabase
      .from("profiles")
      .update({ video_clip_path: null })
      .eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange(null);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Video className="size-4 text-primary" />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Video clip · max {MAX_SEC}s
        </p>
      </div>

      {!videoPath && (
        <div className="mt-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Încarcă clip
          </button>
          <p className="mt-2 text-xs text-muted-foreground">MP4 / MOV / WebM · max {MAX_MB}MB.</p>
        </div>
      )}

      {videoPath && signed && (
        <div className="mt-3 space-y-3">
          <video src={signed} controls playsInline className="w-full rounded-xl bg-black" />
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-full border border-border px-4 py-2 text-xs"
            >
              Înlocuiește
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs text-destructive"
            >
              <Trash2 className="size-3.5" /> Șterge
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />
    </div>
  );
}
