import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, MapPin, Pause, Play, Timer } from "lucide-react";
import { markMediaViewed, signChatMedia, type MessageRow } from "@/lib/chat";
import { cn } from "@/lib/utils";

type Props = { m: MessageRow; mine: boolean };

export function ChatMediaBubble({ m, mine }: Props) {
  if (m.media_type === "location" && m.location_lat != null && m.location_lng != null) {
    const url = `https://www.google.com/maps?q=${m.location_lat},${m.location_lng}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex max-w-[78%] items-center gap-3 rounded-2xl px-3 py-2.5 text-sm",
          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        <MapPin className="size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium leading-tight">Locație partajată</p>
          <p className="truncate text-[11px] opacity-80">Deschide în Maps</p>
        </div>
      </a>
    );
  }

  if (m.media_type === "audio") return <AudioBubble m={m} mine={mine} />;
  if (m.media_type === "image") return <ImageBubble m={m} mine={mine} />;

  return (
    <div
      className={cn(
        "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
        mine
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-muted text-foreground rounded-bl-md",
      )}
    >
      {m.body}
    </div>
  );
}

function AudioBubble({ m, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    signChatMedia(m.media_url).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [m.media_url]);

  function toggle() {
    if (!url) return;
    if (!audioRef.current) {
      const a = new Audio(url);
      audioRef.current = a;
      a.addEventListener("timeupdate", () =>
        setProgress(a.duration ? a.currentTime / a.duration : 0),
      );
      a.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
    }
  }

  // Deterministic waveform bars derived from message id (no decoding needed).
  const bars = useMemo<number[]>(() => {
    const n = 28;
    let h = 0;
    for (let i = 0; i < m.id.length; i++) h = (h * 31 + m.id.charCodeAt(i)) >>> 0;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      const v = ((h >>> 8) % 1000) / 1000; // 0..1
      out.push(0.25 + v * 0.75); // 0.25..1
    }
    return out;
  }, [m.id]);

  const seconds = Math.round((m.audio_duration_ms ?? 0) / 1000);
  return (
    <div
      className={cn(
        "flex max-w-[78%] items-center gap-3 rounded-2xl px-3 py-2",
        mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
      )}
    >
      <button
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pauză" : "Redă"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background/20"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="flex h-8 w-32 items-center gap-[2px]">
        {bars.map((b, i) => {
          const active = i / bars.length <= progress;
          return (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-full transition-opacity",
                active ? "opacity-100" : "opacity-40",
              )}
              style={{ height: `${Math.round(b * 100)}%`, background: "currentColor" }}
            />
          );
        })}
      </div>
      <span className="text-[11px] tabular-nums opacity-90">
        {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, "0")}
      </span>
    </div>
  );
}

function ImageBubble({ m, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!m.view_once);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    let cancelled = false;
    signChatMedia(m.media_url).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [m.media_url, revealed]);

  // For receiver of view-once: mark viewed once they open
  const isViewer = !mine && m.view_once && !opened && revealed;
  useEffect(() => {
    if (isViewer) {
      setOpened(true);
      void markMediaViewed(m.id);
    }
  }, [isViewer, m.id]);

  if (!revealed) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className={cn(
          "flex max-w-[78%] items-center gap-3 rounded-2xl px-4 py-3 text-sm",
          mine ? "bg-primary/80 text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        <Eye className="size-5" />
        <span>Foto view-once · Tap pentru a deschide</span>
      </button>
    );
  }

  // If recipient already viewed once and reload, hide
  if (!mine && m.view_once && m.viewed_at && !opened) {
    return (
      <div
        className={cn(
          "flex max-w-[78%] items-center gap-3 rounded-2xl px-4 py-3 text-sm",
          "bg-muted text-muted-foreground",
        )}
      >
        <EyeOff className="size-5" />
        <span>Foto expirată</span>
      </div>
    );
  }

  return (
    <div
      className={cn("max-w-[78%] overflow-hidden rounded-2xl", mine ? "bg-primary/10" : "bg-muted")}
    >
      {url ? (
        <img src={url} alt="" className="block max-h-80 w-full object-cover" />
      ) : (
        <div className="h-48 w-56 animate-pulse bg-background/30" />
      )}
      {m.view_once && (
        <div className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Timer className="size-3" /> View once
        </div>
      )}
    </div>
  );
}
