import { useEffect, useRef, useState } from "react";
import { Camera, MapPin, Mic, Plus, Square, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { sendMediaMessage, updateLiveLocationMessage, type MessageRow } from "@/lib/chat";
import { cn } from "@/lib/utils";

type Props = {
  conversationId: string;
  onSent: (m: MessageRow) => void;
  onUpdated?: (m: MessageRow) => void;
  disabled?: boolean;
};

export function ChatComposerExtras({ conversationId, onSent, onUpdated, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [liveLocationId, setLiveLocationId] = useState<string | null>(null);
  const [recElapsed, setRecElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileOnceRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<{ mr: MediaRecorder; chunks: BlobPart[]; startedAt: number; stream: MediaStream } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  const liveMessageIdRef = useRef<string | null>(null);
  const lastLocationUpdateRef = useRef(0);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (geoWatchRef.current != null) navigator.geolocation.clearWatch(geoWatchRef.current);
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function pickPhoto(viewOnce: boolean) {
    setOpen(false);
    (viewOnce ? fileOnceRef : fileRef).current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, viewOnce: boolean) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("Imagine prea mare (max 8MB)"); return; }
    setBusy(true);
    try {
      const m = await sendMediaMessage(conversationId, { kind: "image", file: f, viewOnce });
      onSent(m);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  async function shareLocation() {
    setOpen(false);
    if (!("geolocation" in navigator)) return toast.error("Locația nu e disponibilă");
    if (geoWatchRef.current != null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
      liveMessageIdRef.current = null;
      setLiveLocationId(null);
      toast.success("Locația live a fost oprită");
      return;
    }
    setBusy(true);
    geoWatchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const now = Date.now();
          if (liveMessageIdRef.current && now - lastLocationUpdateRef.current < 5000) return;
          lastLocationUpdateRef.current = now;
          const next = { kind: "location" as const, lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!liveMessageIdRef.current) {
            const m = await sendMediaMessage(conversationId, next);
            liveMessageIdRef.current = m.id;
            setLiveLocationId(m.id);
            onSent(m);
            toast.success("Locația live este activă");
          } else {
            const m = await updateLiveLocationMessage(liveMessageIdRef.current, next.lat, next.lng);
            onUpdated?.(m);
          }
        } catch (err) { toast.error((err as Error).message); }
        finally { setBusy(false); }
      },
      (err) => {
        setBusy(false);
        if (geoWatchRef.current != null) navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
        liveMessageIdRef.current = null;
        setLiveLocationId(null);
        toast.error(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15_000 },
    );
  }

  async function startRecording() {
    setOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: pickMime() });
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const startedAt = recRef.current?.startedAt ?? Date.now();
        const duration = Date.now() - startedAt;
        recRef.current = null;
        setRecording(false);
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        if (duration < 500) return;
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setBusy(true);
        try {
          const m = await sendMediaMessage(conversationId, { kind: "audio", file: blob, durationMs: duration });
          onSent(m);
        } catch (err) { toast.error((err as Error).message); }
        finally { setBusy(false); }
      };
      mr.start();
      recRef.current = { mr, chunks, startedAt: Date.now(), stream };
      setRecording(true);
      setRecElapsed(0);
      tickRef.current = setInterval(() => setRecElapsed((s) => s + 1), 1000);
    } catch (err) {
      toast.error((err as Error).message || "Mic indisponibil");
    }
  }

  function stopRecording(cancel = false) {
    const r = recRef.current;
    if (!r) return;
    if (cancel) r.chunks.length = 0;
    r.mr.stop();
  }

  if (recording) {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-2">
        <span className="size-2 animate-pulse rounded-full bg-destructive" />
        <span className="text-xs font-medium text-destructive">Înregistrare {fmt(recElapsed)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => stopRecording(true)} aria-label="Anulează" className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
          <button type="button" onClick={() => stopRecording(false)} aria-label="Trimite" className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Square className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, false)} />
      <input ref={fileOnceRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e, true)} />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled || busy}
          aria-label="Atașament"
          className={cn("flex size-11 items-center justify-center rounded-full bg-muted text-foreground transition", open && "rotate-45")}
        >
          <Plus className="size-5" />
        </button>
        {open && (
          <div className="absolute bottom-14 left-0 z-30 w-44 rounded-2xl border border-border bg-popover p-1 shadow-xl">
            <MenuItem icon={<Camera className="size-4" />} label="Foto" onClick={() => pickPhoto(false)} />
            <MenuItem icon={<Timer className="size-4" />} label="Foto view-once" onClick={() => pickPhoto(true)} />
            <MenuItem icon={<Mic className="size-4" />} label="Voice note" onClick={startRecording} />
            <MenuItem icon={<MapPin className="size-4" />} label={liveLocationId ? "Oprește locația live" : "Locație live"} onClick={shareLocation} />
          </div>
        )}
      </div>
    </>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted">
      <span className="text-primary">{icon}</span>{label}
    </button>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function pickMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const c of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  return "audio/webm";
}
