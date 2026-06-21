import { useState } from "react";
import { Music, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Anthem = { title: string; artist: string; url?: string; preview_url?: string; cover_url?: string } | null;

type Props = {
  userId: string;
  anthem: Anthem;
  onChange: (next: Anthem) => void;
};

export function MusicAnthemCard({ userId, anthem, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(anthem?.url || "");
  const [title, setTitle] = useState(anthem?.title || "");
  const [artist, setArtist] = useState(anthem?.artist || "");
  const [editing, setEditing] = useState(!anthem);

  async function save() {
    if (!title.trim() || !artist.trim()) {
      toast.error("Adaugă titlu și artist.");
      return;
    }
    setBusy(true);
    const next: Anthem = { title: title.trim(), artist: artist.trim(), url: link.trim() || undefined };
    const { error } = await supabase.from("profiles").update({ anthem: next }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange(next);
    setEditing(false);
    toast.success("Anthem salvat.");
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ anthem: null }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange(null);
    setTitle(""); setArtist(""); setLink("");
    setEditing(true);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Music className="size-4 text-primary" />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">My anthem</p>
      </div>

      {!editing && anthem && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Music className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{anthem.title}</p>
            <p className="truncate text-sm text-muted-foreground">{anthem.artist}</p>
            {anthem.url && (
              <a href={anthem.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                Ascultă
              </a>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground underline">Edit</button>
          <button onClick={remove} className="rounded-full p-2 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titlul melodiei"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link Spotify / Apple Music / YouTube (opțional)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : "Salvează"}
            </button>
            {anthem && (
              <button onClick={() => setEditing(false)} className="rounded-full border border-border px-4 py-2 text-xs">
                Anulează
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
