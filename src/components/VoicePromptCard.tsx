import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VOICE_PROMPT_QUESTIONS } from "@/lib/profile-lifestyle-options";

type Props = {
  userId: string;
  voicePath: string | null;
  question: string | null;
  durationSec: number | null;
  onChange: (next: {
    voice_prompt_path: string | null;
    voice_prompt_question: string | null;
    voice_prompt_duration_sec: number | null;
  }) => void;
};

const MAX_SEC = 30;

export function VoicePromptCard({ userId, voicePath, question, durationSec, onChange }: Props) {
  const [signed, setSigned] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentQ, setCurrentQ] = useState(question || VOICE_PROMPT_QUESTIONS[0]);

  const mediaRec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!voicePath) {
      setSigned(null);
      return;
    }
    (async () => {
      const { data } = await supabase.storage
        .from("profile-media")
        .createSignedUrl(voicePath, 3600);
      if (data?.signedUrl) setSigned(data.signedUrl);
    })();
  }, [voicePath]);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mime });
        await upload(blob, mime.includes("mp4") ? "m4a" : "webm");
      };
      rec.start();
      mediaRec.current = rec;
      setRecording(true);
      setElapsed(0);
      timer.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_SEC) {
            stopRec();
            return MAX_SEC;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      toast.error("Microfon indisponibil: " + (e.message || "permisiune respinsă"));
    }
  }

  function stopRec() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (mediaRec.current && mediaRec.current.state !== "inactive") mediaRec.current.stop();
    setRecording(false);
  }

  async function upload(blob: Blob, ext: string) {
    setBusy(true);
    try {
      const path = `${userId}/voice-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("profile-media").upload(path, blob, {
        contentType: blob.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      // delete old file
      if (voicePath) await supabase.storage.from("profile-media").remove([voicePath]);

      const { error } = await supabase
        .from("profiles")
        .update({
          voice_prompt_path: path,
          voice_prompt_question: currentQ,
          voice_prompt_duration_sec: elapsed,
        })
        .eq("id", userId);
      if (error) throw error;

      onChange({
        voice_prompt_path: path,
        voice_prompt_question: currentQ,
        voice_prompt_duration_sec: elapsed,
      });
      toast.success("Voice prompt salvat.");
    } catch (e: any) {
      toast.error(e.message || "Upload eșuat");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!voicePath) return;
    setBusy(true);
    try {
      await supabase.storage.from("profile-media").remove([voicePath]);
      const { error } = await supabase
        .from("profiles")
        .update({
          voice_prompt_path: null,
          voice_prompt_question: null,
          voice_prompt_duration_sec: null,
        })
        .eq("id", userId);
      if (error) throw error;
      onChange({
        voice_prompt_path: null,
        voice_prompt_question: null,
        voice_prompt_duration_sec: null,
      });
      setSigned(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Mic className="size-4 text-primary" />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Voice prompt · max {MAX_SEC}s
        </p>
      </div>

      {!voicePath && (
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-muted-foreground">Alege o întrebare</label>
          <select
            value={currentQ}
            onChange={(e) => setCurrentQ(e.target.value)}
            disabled={recording}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {VOICE_PROMPT_QUESTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>

          {!recording ? (
            <button
              onClick={startRec}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
              Înregistrează
            </button>
          ) : (
            <button
              onClick={stopRec}
              className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground"
            >
              <Square className="size-4" /> Stop · {elapsed}s
            </button>
          )}
        </div>
      )}

      {voicePath && signed && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-foreground/90">{question}</p>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
            <button
              onClick={togglePlay}
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
            </button>
            <div className="flex-1 text-xs text-muted-foreground">
              {durationSec ? `${durationSec}s` : "Audio"}
            </div>
            <button
              onClick={remove}
              disabled={busy}
              className="rounded-full p-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <audio
            ref={audioRef}
            src={signed}
            onEnded={() => setPlaying(false)}
            preload="metadata"
            className="hidden"
          />
          <button
            onClick={remove}
            disabled={busy}
            className="text-xs text-muted-foreground underline"
          >
            Reînregistrează
          </button>
        </div>
      )}
    </div>
  );
}
