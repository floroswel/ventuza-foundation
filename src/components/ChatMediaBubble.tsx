import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, MapPin, Navigation, Pause, Play, Timer, X } from "lucide-react";
import {
  getMessageLocationBucket,
  markMediaViewed,
  signChatMedia,
  type LocationBucket,
  type MessageRow,
} from "@/lib/chat";
import { cn } from "@/lib/utils";

type Props = { m: MessageRow; mine: boolean };

const VIEW_ONCE_SECONDS = 8;

export function ChatMediaBubble({ m, mine }: Props) {
  if (m.media_type === "location") return <LocationBubble m={m} mine={mine} />;
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

// ---------------- LOCATION ----------------

function LocationBubble({ m, mine }: Props) {
  const [info, setInfo] = useState<LocationBucket | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMessageLocationBucket(m.id)
      .then((b) => {
        if (!cancelled) setInfo(b);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [m.id]);

  const label = loading
    ? mine
      ? "Locația trimisă"
      : "Se calculează…"
    : (info?.label ?? "Distanță indisponibilă");

  const canOpen = !!info?.can_open_map && info.lat != null && info.lng != null;

  return (
    <>
      <button
        type="button"
        onClick={() => canOpen && setMapOpen(true)}
        disabled={!canOpen}
        className={cn(
          "flex max-w-[78%] items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition",
          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          canOpen && "cursor-pointer hover:brightness-110",
        )}
      >
        <MapPin className="size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium leading-tight">Locație partajată</p>
          <p className="truncate text-[11px] opacity-80">
            {mine ? "Trimisă în siguranță" : `Distanță aproximativă: ${label}`}
          </p>
          {canOpen && (
            <p className="mt-0.5 text-[10px] opacity-75">Tap pentru a deschide harta</p>
          )}
        </div>
      </button>
      {mapOpen && info?.lat != null && info?.lng != null && (
        <LocationMap
          lat={info.lat}
          lng={info.lng}
          title={mine ? "Locația trimisă" : "Locație primită"}
          onClose={() => setMapOpen(false)}
        />
      )}
    </>
  );
}

function LocationMap({
  lat,
  lng,
  title,
  onClose,
}: {
  lat: number;
  lng: number;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`;
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
        <p className="text-sm font-medium">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="flex size-9 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex-1">
        <iframe
          title="Hartă"
          src={src}
          className="h-full w-full border-0"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-white/10 bg-black/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <a
          href={gmaps}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground hover:brightness-110"
        >
          <Navigation className="size-4" /> Navighează cu Google Maps
        </a>
        <a
          href={osm}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-xs text-white/80 hover:bg-white/10"
        >
          Deschide în OpenStreetMap
        </a>
      </div>
    </div>
  );
}

// ---------------- AUDIO ----------------

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

  const bars = useMemo<number[]>(() => {
    const n = 28;
    let h = 0;
    for (let i = 0; i < m.id.length; i++) h = (h * 31 + m.id.charCodeAt(i)) >>> 0;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      const v = ((h >>> 8) % 1000) / 1000;
      out.push(0.25 + v * 0.75);
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

// ---------------- IMAGE ----------------

function ImageBubble({ m, mine }: Props) {
  const alreadyBurned = !mine && !!m.view_once && !!m.viewed_at;
  const [url, setUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewedOnce, setViewedOnce] = useState(alreadyBurned);
  const [retryTick, setRetryTick] = useState(0);

  // Sign URL as soon as bubble mounts (needed for both preview and fullscreen).
  useEffect(() => {
    if (!m.media_url) return;
    if (alreadyBurned) return;
    let cancelled = false;
    setUrlError(null);
    setUrl(null);
    signChatMedia(m.media_url)
      .then((u) => {
        if (cancelled) return;
        if (!u) setUrlError("Poza nu mai este disponibilă");
        else setUrl(u);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Eroare la încărcare";
          setUrlError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [m.media_url, alreadyBurned, retryTick]);

  function retry() {
    setUrlError(null);
    setRetryTick((n) => n + 1);
  }

  function openFullscreen() {
    if (!url) return;
    setFullscreen(true);
    if (!mine && m.view_once && !viewedOnce) {
      setViewedOnce(true);
      void markMediaViewed(m.id);
    }
  }

  // Recipient-side burned view-once: don't show anything openable.
  if (alreadyBurned) {
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

  // View-once (not yet viewed by recipient): show sealed placeholder.
  if (!mine && m.view_once && !viewedOnce) {
    return (
      <>
        <button
          type="button"
          onClick={openFullscreen}
          disabled={!url}
          className={cn(
            "flex max-w-[78%] items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
            "bg-muted text-foreground hover:brightness-110",
            !url && "opacity-60",
          )}
        >
          <Eye className="size-5" />
          <span>Foto view-once · Tap pentru a deschide</span>
        </button>
        {fullscreen && url && (
          <FullscreenImage
            src={url}
            viewOnce
            onClose={() => setFullscreen(false)}
          />
        )}
      </>
    );
  }

  // Normal image (or sender's own view-once preview).
  return (
    <>
      <div
        className={cn(
          "max-w-[78%] overflow-hidden rounded-2xl",
          mine ? "bg-primary/10" : "bg-muted",
        )}
        data-private-media
      >
        {url ? (
          <img
            key={url}
            src={url}
            alt=""
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onClick={openFullscreen}
            onError={() => {
              setUrl(null);
              setUrlError("Poza nu s-a încărcat");
            }}
            className="block max-h-80 w-full cursor-zoom-in select-none object-cover"
            style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
          />
        ) : urlError ? (
          <button
            type="button"
            onClick={retry}
            className="flex h-32 w-56 flex-col items-center justify-center gap-2 px-3 text-center text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{urlError}</span>
            <span className="rounded-full bg-background/50 px-3 py-1 text-[11px] uppercase tracking-wider">
              Reîncearcă
            </span>
          </button>
        ) : (
          <div className="h-48 w-56 animate-pulse bg-background/30" />
        )}
        {m.view_once && (
          <div className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Timer className="size-3" /> View once
          </div>
        )}
      </div>
      {fullscreen && url && (
        <FullscreenImage
          src={url}
          viewOnce={!!m.view_once && !mine}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}

function FullscreenImage({
  src,
  viewOnce,
  onClose,
}: {
  src: string;
  viewOnce?: boolean;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // View-once timer: fills in VIEW_ONCE_SECONDS then auto-closes.
  useEffect(() => {
    if (!viewOnce) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const p = Math.min(1, elapsed / VIEW_ONCE_SECONDS);
      setProgress(p);
      if (p >= 1) {
        onClose();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [viewOnce, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-private-media
    >
      {viewOnce && (
        <div className="pointer-events-none absolute inset-x-4 top-4 h-1 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full bg-white"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Închide"
        className="absolute right-4 top-6 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
      >
        <X className="size-5" />
      </button>
      <img
        src={src}
        alt=""
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onClick={onClose}
        className="max-h-full max-w-full cursor-pointer select-none object-contain"
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
      />
    </div>
  );
}
