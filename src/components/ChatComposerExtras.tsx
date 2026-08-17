import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Mic,
  Plus,
  RefreshCw,
  Square,
  Timer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { sendMediaMessage, updateLiveLocationMessage, type MessageRow } from "@/lib/chat";
import { compressImageForChat } from "@/lib/image-compress";
import { isNativeCameraAvailable, pickImage } from "@/lib/native-camera";
import { watchPosition, type WatchHandle } from "@/lib/native-geolocation";
import { cn } from "@/lib/utils";

type UploadJob = {
  id: string;
  name: string;
  status: "uploading" | "error" | "done";
  attempt: number;
  maxAttempts: number;
  error?: string;
  file: File;
  viewOnce: boolean;
};

const MAX_ATTEMPTS = 3;

function isTransient(err: unknown): boolean {
  const msg = (err as Error)?.message?.toLowerCase() ?? "";
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("temporarily") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("429")
  );
}



type Props = {
  conversationId: string;
  onSent: (m: MessageRow) => void;
  onUpdated?: (m: MessageRow) => void;
  disabled?: boolean;
  /** "menu" = buton + cu meniu (default); "row" = iconițe inline sub input (stil nativ). */
  variant?: "menu" | "row";
};

export function ChatComposerExtras({
  conversationId,
  onSent,
  onUpdated,
  disabled,
  variant = "menu",
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [liveLocationId, setLiveLocationId] = useState<string | null>(null);
  const [recElapsed, setRecElapsed] = useState(0);
  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileOnceRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);


  const recRef = useRef<{
    mr: MediaRecorder;
    chunks: BlobPart[];
    startedAt: number;
    stream: MediaStream;
  } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoWatchRef = useRef<WatchHandle | null>(null);
  const liveMessageIdRef = useRef<string | null>(null);
  const lastLocationUpdateRef = useRef(0);

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      geoWatchRef.current?.clear();
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function pickPhoto(source: "gallery" | "camera" | "gallery-once") {
    setOpen(false);
    try {
      // On web, use hidden multi-file input for gallery to preserve multi-select.
      // On native, Capacitor Camera returns a single image.
      const native = await isNativeCameraAvailable();
      if (!native && source !== "camera") {
        const el = source === "gallery-once" ? fileOnceRef.current : fileRef.current;
        el?.click();
        return;
      }
      const file = await pickImage(source === "camera" ? "camera" : "gallery");
      if (!file) return;
      const viewOnce = source === "gallery-once";
      await enqueueFiles([file], viewOnce);
    } catch (err) {
      toast.error((err as Error).message || "Nu am putut deschide camera");
    }
  }

  function updateJob(id: string, patch: Partial<UploadJob>) {
    setUploads((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  async function attemptUpload(job: UploadJob) {
    updateJob(job.id, { status: "uploading", error: undefined });
    try {
      const compressed = await compressImageForChat(job.file);
      const m = await sendMediaMessage(conversationId, {
        kind: "image",
        file: compressed,
        viewOnce: job.viewOnce,
      });
      onSent(m);
      updateJob(job.id, { status: "done" });
      // Auto-clean successful jobs after short delay.
      setTimeout(() => {
        setUploads((prev) => prev.filter((j) => j.id !== job.id));
      }, 1500);
    } catch (err) {
      const message = (err as Error)?.message ?? "Eroare necunoscută";
      const attempt = job.attempt;
      if (attempt < job.maxAttempts && isTransient(err)) {
        const delay = 400 * Math.pow(2, attempt - 1);
        updateJob(job.id, { error: `Reîncerc (${attempt}/${job.maxAttempts})…` });
        await new Promise((r) => setTimeout(r, delay));
        await attemptUpload({ ...job, attempt: attempt + 1 });
      } else {
        updateJob(job.id, { status: "error", error: message });
        toast.error(`Nu am putut trimite "${job.name}": ${message}`);
      }
    }
  }

  async function retryUpload(id: string) {
    const job = uploads.find((j) => j.id === id);
    if (!job) return;
    await attemptUpload({ ...job, attempt: 1, status: "uploading", error: undefined });
  }

  function dismissUpload(id: string) {
    setUploads((prev) => prev.filter((j) => j.id !== id));
  }

  async function enqueueFiles(files: File[], viewOnce: boolean) {
    const MAX = 10;
    if (files.length > MAX) {
      toast.error(`Maxim ${MAX} imagini deodată`);
      return;
    }
    const jobs: UploadJob[] = [];
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`"${f.name}" e prea mare (max 20MB)`);
        continue;
      }
      jobs.push({
        id: crypto.randomUUID(),
        name: f.name,
        status: "uploading",
        attempt: 1,
        maxAttempts: MAX_ATTEMPTS,
        file: f,
        viewOnce,
      });
    }
    if (!jobs.length) return;
    setUploads((prev) => [...prev, ...jobs]);
    setBusy(true);
    try {
      for (const j of jobs) {
        await attemptUpload(j);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, viewOnce: boolean) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    await enqueueFiles(files, viewOnce);
  }





  async function shareLocation() {
    setOpen(false);
    if (geoWatchRef.current) {
      geoWatchRef.current.clear();
      geoWatchRef.current = null;
      liveMessageIdRef.current = null;
      setLiveLocationId(null);
      toast.success("Locația live a fost oprită");
      return;
    }
    setBusy(true);
    geoWatchRef.current = await watchPosition(
      async (pos) => {
        try {
          const now = Date.now();
          if (liveMessageIdRef.current && now - lastLocationUpdateRef.current < 5000) return;
          lastLocationUpdateRef.current = now;
          const next = {
            kind: "location" as const,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
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
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        geoWatchRef.current?.clear();
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
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const startedAt = recRef.current?.startedAt ?? Date.now();
        const duration = Date.now() - startedAt;
        recRef.current = null;
        setRecording(false);
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        if (duration < 500) return;
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setBusy(true);
        try {
          const m = await sendMediaMessage(conversationId, {
            kind: "audio",
            file: blob,
            durationMs: duration,
          });
          onSent(m);
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
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
          <button
            type="button"
            onClick={() => stopRecording(true)}
            aria-label="Anulează"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            aria-label="Trimite"
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Square className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFile(e, false)}
      />
      <input
        ref={fileOnceRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFile(e, true)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e, false)}
      />

      {uploads.length > 0 && (
        <div className="absolute bottom-16 left-2 right-2 z-30 flex max-h-64 flex-col gap-1 overflow-y-auto">
          {uploads.map((j) => (
            <div
              key={j.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur",
                j.status === "uploading" && "border-border bg-popover/95 text-foreground",
                j.status === "done" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                j.status === "error" && "border-destructive/50 bg-destructive/10 text-destructive",
              )}
            >
              {j.status === "uploading" && <Loader2 className="size-4 shrink-0 animate-spin" />}
              {j.status === "error" && <AlertTriangle className="size-4 shrink-0" />}
              {j.status === "done" && <ImageIcon className="size-4 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{j.name}</div>
                <div className="truncate opacity-80">
                  {j.status === "uploading" &&
                    (j.error ?? `Se încarcă… (încercare ${j.attempt}/${j.maxAttempts})`)}
                  {j.status === "done" && "Trimis ✓"}
                  {j.status === "error" && (j.error ?? "Eroare la trimitere")}
                </div>
              </div>
              {j.status === "error" && (
                <>
                  <button
                    type="button"
                    onClick={() => retryUpload(j.id)}
                    className="flex items-center gap-1 rounded-md bg-destructive/20 px-2 py-1 text-[11px] font-medium hover:bg-destructive/30"
                    aria-label="Reîncearcă"
                  >
                    <RefreshCw className="size-3" />
                    Reîncearcă
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissUpload(j.id)}
                    className="rounded-md p-1 opacity-70 hover:opacity-100"
                    aria-label="Renunță"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {variant === "row" ? (
        <>
          <IconAction
            label="Cameră"
            disabled={disabled || busy}
            onClick={() => pickPhoto("camera")}
            icon={<Camera className="size-5" />}
          />
          <IconAction
            label="Galerie"
            disabled={disabled || busy}
            onClick={() => pickPhoto("gallery")}
            icon={<ImageIcon className="size-5" />}
          />
          <IconAction
            label="Foto o singură vizualizare"
            disabled={disabled || busy}
            onClick={() => pickPhoto("gallery-once")}
            icon={<Timer className="size-5" />}
          />
          <IconAction
            label="Voice note"
            disabled={disabled || busy}
            onClick={startRecording}
            icon={<Mic className="size-5" />}
          />
          <IconAction
            label={liveLocationId ? "Oprește locația live" : "Locație live"}
            disabled={disabled || busy}
            onClick={shareLocation}
            active={!!liveLocationId}
            icon={<MapPin className="size-5" />}
          />
        </>
      ) : (
      <div className="relative">

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled || busy}
          aria-label="Atașament"
          className={cn(
            "flex size-11 items-center justify-center rounded-full bg-muted text-foreground transition",
            open && "rotate-45",
          )}
        >
          <Plus className="size-5" />
        </button>
        {open && (
          <div className="absolute bottom-14 left-0 z-30 w-56 rounded-2xl border border-border bg-popover p-1 shadow-xl">
            <MenuItem
              icon={<Camera className="size-4" />}
              label="Cameră (foto instant)"
              onClick={() => pickPhoto("camera")}
            />
            <MenuItem
              icon={<ImageIcon className="size-4" />}
              label="Galerie"
              onClick={() => pickPhoto("gallery")}
            />
            <MenuItem
              icon={<Timer className="size-4" />}
              label="Foto o singură vizualizare"
              onClick={() => pickPhoto("gallery-once")}
            />

            <MenuItem
              icon={<Mic className="size-4" />}
              label="Voice note"
              onClick={startRecording}
            />
            <MenuItem
              icon={<MapPin className="size-4" />}
              label={liveLocationId ? "Oprește locația live" : "Locație live"}
              onClick={shareLocation}
            />
          </div>
        )}
      </div>
      )}
    </>
  );
}

function IconAction({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors disabled:opacity-40",
        active ? "text-primary" : "hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function pickMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const c of candidates)
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  return "audio/webm";
}
