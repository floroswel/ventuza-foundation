import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { signPhotos } from "@/lib/discover";
import { fetchPublicProfiles, getOrCreateConversation, type PublicProfileMini } from "@/lib/chat";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/matches")({
  ssr: false,
  head: () => ({ meta: [{ title: "Potriviri — Suzeta" }, { name: "robots", content: "noindex" }] }),
  component: MatchesPage,
});

type MatchRow = {
  id: string;
  other_id: string;
  created_at: string;
  profile: PublicProfileMini | null;
  photo_url: string | null;
};

function MatchesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("matches")
          .select("id, user_a, user_b, created_at")
          .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const items = (data ?? []).map((m) => ({
          id: m.id as string,
          created_at: m.created_at as string,
          other_id: (m.user_a === user!.id ? m.user_b : m.user_a) as string,
        }));
        const profiles = await fetchPublicProfiles(items.map((x) => x.other_id));
        const photoPaths = Array.from(profiles.values())
          .map((p) => p?.photo)
          .filter(Boolean) as string[];
        const signed = photoPaths.length ? await signPhotos(photoPaths) : {};
        const enriched: MatchRow[] = items.map((it) => {
          const prof = profiles.get(it.other_id) ?? null;
          const photo = prof?.photo ? (signed[prof.photo] ?? null) : null;
          return { ...it, profile: prof, photo_url: photo };
        });
        if (alive) setRows(enriched);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [user]);

  async function openChat(otherId: string) {
    if (opening) return;
    setOpening(otherId);
    try {
      const convId = await getOrCreateConversation(otherId);
      navigate({ to: "/messages/$id", params: { id: convId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-background/85 px-5 py-4 text-center backdrop-blur">
        <h1 className="font-serif text-2xl tracking-wide text-primary">Potriviri</h1>
      </header>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Încă niciun match"
            body="Când tu și altcineva vă apreciați reciproc, apar aici."
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {rows.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => void openChat(m.other_id)}
                  disabled={opening === m.other_id}
                  className={cn(
                    "group relative flex aspect-[3/4] w-full flex-col justify-end overflow-hidden rounded-2xl border border-primary/25 bg-surface text-left shadow-sm transition-transform",
                    "hover:-translate-y-0.5 hover:shadow-[0_0_20px_hsl(var(--primary)/0.25)]",
                  )}
                >
                  {m.photo_url ? (
                    <img
                      src={m.photo_url}
                      alt={m.profile?.name ?? ""}
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-3xl text-muted-foreground/50">
                      {(m.profile?.name ?? "?").slice(0, 1)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <div className="relative z-10 flex items-end justify-between p-3">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base text-primary">
                        {m.profile?.name ?? "—"}
                      </p>
                      <p className="text-[11px] text-white/70">
                        Trimite mesaj
                      </p>
                    </div>
                    {m.profile?.online && (
                      <span className="size-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                    )}
                  </div>
                  {opening === m.other_id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
