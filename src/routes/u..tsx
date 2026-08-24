import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
/**
 * Bara de acțiuni de pe profilul public, pentru vizitatori logați.
 * „Mesaj" deschide/creează conversația (RPC gated 18+), „Favorit" salvează profilul.
import { BadgeCheck, Languages, Loader2, Mic, Music, ArrowLeft, Heart, Video, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
function ProfileActions({ targetId, name }: { targetId: string; name: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | "msg" | "fav">(null);
  const [faved, setFaved] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { isFavorite } = await import("@/lib/social");
      const v = await isFavorite(targetId).catch(() => false);
      if (alive) setFaved(v);
    })();
    return () => {
      alive = false;
    };
  }, [targetId]);

  function explain(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (/age_verification_required/.test(msg)) return "Confirmă că ai 18+ ca să poți scrie mesaje.";
    if (/email_not_confirmed/.test(msg)) return "Confirmă adresa de email ca să poți scrie mesaje.";
    if (/blocked/.test(msg)) return "Nu poți contacta acest profil.";
    return msg;
  }

  async function message() {
    setBusy("msg");
    try {
      const { getOrCreateConversation } = await import("@/lib/chat");
      const id = await getOrCreateConversation(targetId);
      navigate({ to: "/messages/$id", params: { id } });
    } catch (e) {
      const m = explain(e);
      if (/18\+/.test(m)) {
        toast.error(m, { action: { label: "Verifică", onClick: () => navigate({ to: "/verify" }) } });
      } else {
        toast.error(m);
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggleFav() {
    setBusy("fav");
    try {
      const { addFavorite, removeFavorite } = await import("@/lib/social");
      if (faved) {
        await removeFavorite(targetId);
        setFaved(false);
        toast.success("Șters din favorite");
      } else {
        await addFavorite(targetId);
        setFaved(true);
        toast.success(`${name} salvat la favorite`);
      }
    } catch (e) {
      toast.error(explain(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={message}
        disabled={busy !== null}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy === "msg" ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        Mesaj
      </button>
      <button
        type="button"
        onClick={toggleFav}
        disabled={busy !== null}
        aria-pressed={faved}
        className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-60 ${faved ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-foreground"}`}
      >
        {busy === "fav" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Star className={`size-4 ${faved ? "fill-current" : ""}`} />
        )}
        {faved ? "Favorit" : "Salvează"}
      </button>
    </div>
  );
}
