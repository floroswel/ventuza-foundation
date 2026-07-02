import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { listFavorites, removeFavorite, type FavoriteRow } from "@/lib/social";
import { signPhotos, formatLastSeen, isOnline } from "@/lib/discover";
import { getOrCreateConversation } from "@/lib/chat";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/favorites")({
  ssr: false,
  head: () => ({ meta: [{ title: "Favorite — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const list = await listFavorites();
        setRows(list);
        const paths = list.flatMap((r) => (r.photos ?? []).slice(0, 1));
        if (paths.length) setUrls(await signPhotos(paths));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function unfav(id: string) {
    try {
      await removeFavorite(id);
      setRows((r) => r.filter((x) => x.favorite_id !== id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function openChat(id: string) {
    try {
      const convId = await getOrCreateConversation(id);
      navigate({ to: "/messages/$id", params: { id: convId } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/profile"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Star className="size-4 fill-primary text-primary" /> Favorite
        </h1>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
      </header>

      <div className="mx-auto max-w-md px-3 py-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            <Star className="mx-auto mb-2 size-8 text-primary/60" />
            Nu ai salvat încă pe nimeni la favorite. Apasă ⭐ pe un profil în Discover ca să-l
            salvezi aici.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {rows.map((r) => {
              const photo = r.photos?.[0];
              const photoUrl = photo ? urls[photo] : null;
              const online = r.last_seen ? isOnline(r.last_seen) : false;
              return (
                <li
                  key={r.favorite_id}
                  className="overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <button
                    onClick={() => openChat(r.favorite_id)}
                    className="relative block aspect-[3/4] w-full bg-background"
                  >
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={r.display_name ?? ""}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-3xl text-muted-foreground/40">
                        {r.display_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="truncate text-xs font-medium text-white">
                        {r.display_name ?? "Anonim"}
                      </p>
                      {r.last_seen && (
                        <p className="text-[10px] text-white/70">
                          <span
                            className={cn(
                              "mr-1 inline-block size-1.5 rounded-full",
                              online ? "bg-emerald-400" : "bg-white/40",
                            )}
                          />
                          {formatLastSeen(r.last_seen)}
                        </p>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => unfav(r.favorite_id)}
                    className="w-full border-t border-border/60 px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
                  >
                    Elimină
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
