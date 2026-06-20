import { useEffect, useRef, useState } from "react";
import { Lock, Loader2, Plus, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MAX = 12;
const MAX_SIZE_MB = 8;

export function PrivateAlbumManager({ userId }: { userId: string }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Array<{ id: string; requester_id: string; requester_name: string | null }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("private_albums")
      .select("photos")
      .eq("owner_id", userId)
      .maybeSingle();
    const list = (data?.photos as string[] | null) ?? [];
    setPhotos(list);
    const out: Record<string, string> = {};
    for (const p of list) {
      const { data: s } = await supabase.storage.from("private-albums").createSignedUrl(p, 3600);
      if (s?.signedUrl) out[p] = s.signedUrl;
    }
    setSigned(out);

    // pending requests
    const { data: reqs } = await supabase
      .from("album_requests")
      .select("id, requester_id, profiles:requester_id(display_name)")
      .eq("owner_id", userId)
      .eq("status", "pending");
    setPending(
      (reqs ?? []).map((r) => ({
        id: r.id,
        requester_id: r.requester_id,
        requester_name: (r as { profiles?: { display_name?: string | null } }).profiles?.display_name ?? null,
      })),
    );
    setLoading(false);
  }

  useEffect(() => { void load(); }, [userId]);

  async function save(next: string[]) {
    setPhotos(next);
    const { error } = await supabase.from("private_albums").upsert(
      { owner_id: userId, photos: next },
      { onConflict: "owner_id" },
    );
    if (error) toast.error(error.message);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX - photos.length;
    if (room <= 0) { toast.error(`Maxim ${MAX} poze în album.`); return; }
    setBusy(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, room)) {
        if (file.size > MAX_SIZE_MB * 1024 * 1024) { toast.error(`${file.name} > ${MAX_SIZE_MB}MB`); continue; }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("private-albums").upload(path, file, { contentType: file.type });
        if (error) { toast.error(error.message); continue; }
        added.push(path);
      }
      if (added.length) {
        await save([...photos, ...added]);
        await load();
        toast.success(`${added.length} adăugate în album`);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(path: string) {
    await supabase.storage.from("private-albums").remove([path]);
    await save(photos.filter((p) => p !== path));
  }

  async function accept(req: { id: string; requester_id: string }) {
    await supabase.from("album_unlocks").insert({ owner_id: userId, viewer_id: req.requester_id });
    await supabase.from("album_requests").update({ status: "accepted" }).eq("id", req.id);
    toast.success("Acces acordat");
    load();
  }

  async function deny(req: { id: string }) {
    await supabase.from("album_requests").update({ status: "denied" }).eq("id", req.id);
    load();
  }

  if (loading) {
    return <div className="flex justify-center p-6"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">Album privat</p>
            <p className="text-xs text-muted-foreground">Poze pe care doar oamenii cărora le acorzi acces le pot vedea.</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {photos.map((p) => (
            <div key={p} className="group relative aspect-square overflow-hidden rounded-lg bg-background">
              {signed[p] ? (
                <img src={signed[p]} className="size-full object-cover" alt="" />
              ) : (
                <div className="flex size-full items-center justify-center"><Loader2 className="size-3 animate-spin" /></div>
              )}
              <button
                onClick={() => remove(p)}
                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {photos.length < MAX && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-5" />}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {pending.length > 0 && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium text-primary">Cereri în așteptare ({pending.length})</p>
          <div className="mt-2 space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-background p-2.5">
                <p className="text-sm">{r.requester_name ?? "Cineva"}</p>
                <div className="flex gap-1.5">
                  <button onClick={() => deny(r)} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Refuz</button>
                  <button onClick={() => accept(r)} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Acordă</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Buton+UI pentru vizitator: cere acces sau vede albumul dacă unlock acordat */
export function PrivateAlbumViewer({ ownerId, currentUserId }: { ownerId: string; currentUserId: string }) {
  const [state, setState] = useState<"loading" | "none" | "pending" | "unlocked" | "denied">("loading");
  const [photos, setPhotos] = useState<string[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [hasAlbum, setHasAlbum] = useState(false);

  async function check() {
    const { data: album } = await supabase
      .from("private_albums")
      .select("photos")
      .eq("owner_id", ownerId)
      .maybeSingle();
    setHasAlbum(!!album?.photos?.length);

    const { data: unlock } = await supabase
      .from("album_unlocks")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("viewer_id", currentUserId)
      .maybeSingle();
    if (unlock) {
      const list = (album?.photos as string[] | null) ?? [];
      setPhotos(list);
      const out: Record<string, string> = {};
      for (const p of list) {
        const { data: s } = await supabase.storage.from("private-albums").createSignedUrl(p, 3600);
        if (s?.signedUrl) out[p] = s.signedUrl;
      }
      setSigned(out);
      setState("unlocked");
      return;
    }

    const { data: req } = await supabase
      .from("album_requests")
      .select("status")
      .eq("owner_id", ownerId)
      .eq("requester_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (req?.status === "pending") setState("pending");
    else if (req?.status === "denied") setState("denied");
    else setState("none");
  }

  useEffect(() => { void check(); }, [ownerId, currentUserId]);

  async function request() {
    const { error } = await supabase.from("album_requests").insert({
      owner_id: ownerId, requester_id: currentUserId, status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Cerere trimisă");
    setState("pending");
  }

  if (state === "loading" || !hasAlbum) return null;

  if (state === "unlocked") {
    return (
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Lock className="size-3" /> Album privat ({photos.length})
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <div key={p} className="aspect-square overflow-hidden rounded-lg bg-background">
              {signed[p] && <img src={signed[p]} className="size-full object-cover" alt="" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
      <Lock className="mx-auto mb-2 size-6 text-primary" />
      <p className="text-sm font-medium">Are un album privat</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {state === "pending" ? "Cererea ta e în așteptare." :
         state === "denied" ? "Cererea ta a fost refuzată." :
         "Cere acces ca să vezi pozele private."}
      </p>
      {state === "none" && (
        <button onClick={request} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
          <ImagePlus className="size-3" /> Cere acces
        </button>
      )}
    </div>
  );
}
