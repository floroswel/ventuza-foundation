import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  ShieldCheck,
  Star,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { moderatePhoto } from "@/lib/verification.functions";
import { cn } from "@/lib/utils";
import { computePhash } from "@/lib/phash";

const MAX_PHOTOS = 6;
const MAX_SIZE_MB = 8;
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
const ACCEPTED_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

type QueueStatus = "queued" | "uploading" | "moderating" | "done" | "error";
type QueueItem = { id: string; name: string; sizeMb: number; status: QueueStatus; error?: string };

type Props = {
  userId: string;
  photos: string[];
  onChange: (next: string[]) => void;
  persist?: boolean; // if true, writes to profiles.photos on every change
  className?: string;
};

function isAcceptedFile(file: File): { ok: true } | { ok: false; reason: string } {
  const type = (file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const typeOk = type ? (ACCEPTED_TYPES as readonly string[]).includes(type) : false;
  const extOk = ACCEPTED_EXT.includes(ext);
  if (!typeOk && !extOk)
    return { ok: false, reason: "format nesuportat (doar JPG, PNG, WEBP, HEIC)" };
  if (file.size > MAX_SIZE_MB * 1024 * 1024)
    return { ok: false, reason: `depășește ${MAX_SIZE_MB} MB` };
  if (file.size === 0) return { ok: false, reason: "fișier gol" };
  return { ok: true };
}

export function PhotoManager({ userId, photos, onChange, persist = true, className }: Props) {
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const moderate = useServerFn(moderatePhoto);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const p of photos) {
        if (p.startsWith("http")) {
          out[p] = p;
          continue;
        }
        const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
        if (data?.signedUrl) out[p] = data.signedUrl;
      }
      if (!cancelled) setSigned(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  function updateQueue(id: string, patch: Partial<QueueItem>) {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function savePhotos(next: string[]) {
    onChange(next);
    if (!persist) return;
    const { error } = await supabase.from("profiles").update({ photos: next }).eq("id", userId);
    if (error) toast.error(error.message);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Ai deja ${MAX_PHOTOS} poze. Șterge una ca să adaugi alta.`);
      return;
    }

    const all = Array.from(files);
    const list = all.slice(0, room);
    const dropped = all.length - list.length;
    if (dropped > 0) {
      toast.warning(
        `Am păstrat primele ${list.length} poze. ${dropped} nu încap (max ${MAX_PHOTOS}).`,
      );
    }

    // Preflight validation → build the queue up-front so userul vede tot ce urmează
    const initial: QueueItem[] = list.map((f) => {
      const id = crypto.randomUUID();
      const check = isAcceptedFile(f);
      return {
        id,
        name: f.name,
        sizeMb: +(f.size / (1024 * 1024)).toFixed(2),
        status: check.ok ? "queued" : "error",
        error: check.ok ? undefined : check.reason,
      };
    });
    setQueue(initial);

    setBusy(true);
    const added: string[] = [];
    try {
      for (let idx = 0; idx < list.length; idx++) {
        const file = list[idx];
        const item = initial[idx];
        if (item.status === "error") continue;

        updateQueue(item.id, { status: "uploading" });
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("profile-photos")
          .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
        if (upErr) {
          updateQueue(item.id, { status: "error", error: upErr.message });
          continue;
        }

        // AI moderation — BLOCKING
        updateQueue(item.id, { status: "moderating" });
        try {
          const { data: signedData } = await supabase.storage
            .from("profile-photos")
            .createSignedUrl(path, 300);
          if (signedData?.signedUrl) {
            const mod = await moderate({ data: { photoUrl: signedData.signedUrl } });
            if (!mod.allowed) {
              await supabase.storage.from("profile-photos").remove([path]);
              updateQueue(item.id, {
                status: "error",
                error: `respinsă: ${mod.reason || "conținut nepermis pe profilul public"}`,
              });
              continue;
            }
          }
        } catch (modErr) {
          await supabase.storage.from("profile-photos").remove([path]);
          updateQueue(item.id, {
            status: "error",
            error: `moderare eșuată: ${(modErr as Error).message}`,
          });
          continue;
        }

        // Perceptual hash → server (catfishing detection) — non-blocking
        try {
          const phash = await computePhash(file);
          if (phash) await supabase.rpc("record_photo_hash", { _path: path, _phash: phash });
        } catch {
          /* non-blocking */
        }

        added.push(path);
        updateQueue(item.id, { status: "done" });
      }

      if (added.length) {
        await savePhotos([...photos, ...added]);
        toast.success(`${added.length} ${added.length > 1 ? "poze urcate" : "poză urcată"}.`);
      }
      const errored = initial.filter(
        (it) => it.status === "error" || queue.find((q) => q.id === it.id)?.status === "error",
      ).length;
      if (errored > 0 && added.length === 0) {
        toast.error("Nicio poză nu a trecut de validare.");
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      // Auto-hide queue după 4s dacă totul e OK; păstrează pe ecran dacă sunt erori
      setTimeout(() => {
        setQueue((q) => (q.some((it) => it.status === "error") ? q : []));
      }, 4000);
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

  const remaining = MAX_PHOTOS - photos.length;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Poze · {photos.length}/{MAX_PHOTOS}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Tap ★ pentru principală · ◂ ▸ pentru reordonare
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        JPG, PNG, WEBP sau HEIC · max {MAX_SIZE_MB} MB / poză · maxim {MAX_PHOTOS} poze
        {remaining > 0 && photos.length > 0 ? ` · mai poți adăuga ${remaining}` : ""}
      </p>

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
              aria-label="Șterge poza"
              className="absolute right-1.5 top-1.5 rounded-full bg-background/85 p-1 text-foreground backdrop-blur hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="size-3" />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/70 px-1 py-1 backdrop-blur">
              <button
                onClick={() => move(p, -1)}
                disabled={i === 0}
                aria-label="Mută stânga"
                className="rounded p-1 text-foreground/80 hover:text-primary disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                onClick={() => makePrimary(p)}
                aria-label="Setează ca principală"
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
                aria-label="Mută dreapta"
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
            aria-label={`Adaugă poze (mai poți urca ${remaining})`}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-background/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
            <span className="text-[10px] uppercase tracking-wider">
              {busy ? "Se urcă…" : "Adaugă"}
            </span>
          </button>
        )}
      </div>

      {queue.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-1.5 rounded-xl border border-border bg-surface/60 p-2"
        >
          {queue.map((it) => {
            const label =
              it.status === "queued"
                ? "În așteptare"
                : it.status === "uploading"
                  ? "Se urcă"
                  : it.status === "moderating"
                    ? "Se verifică"
                    : it.status === "done"
                      ? "Gata"
                      : "Eroare";
            const Icon =
              it.status === "done"
                ? CheckCircle2
                : it.status === "error"
                  ? AlertCircle
                  : it.status === "moderating"
                    ? ShieldCheck
                    : it.status === "uploading"
                      ? Upload
                      : Loader2;
            const tone =
              it.status === "done"
                ? "text-emerald-500"
                : it.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground";
            const spinning =
              it.status === "uploading" || it.status === "moderating" || it.status === "queued";
            return (
              <div key={it.id} className="flex items-center gap-2 text-xs">
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    tone,
                    spinning && it.status === "queued" && "animate-spin",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{it.sizeMb} MB</span>
                <span
                  className={cn("shrink-0 text-[10px] font-medium uppercase tracking-wider", tone)}
                >
                  {label}
                </span>
                {it.status !== "done" && it.status !== "error" && (
                  <span className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn(
                        "block h-full rounded-full bg-primary",
                        it.status === "queued"
                          ? "w-1/6"
                          : it.status === "uploading"
                            ? "w-1/2 animate-pulse"
                            : "w-5/6 animate-pulse",
                      )}
                    />
                  </span>
                )}
                {it.error && (
                  <span className="basis-full pl-5 text-[10px] text-destructive">{it.error}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
