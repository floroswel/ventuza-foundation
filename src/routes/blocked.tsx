import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { listBlocked, unblock, type BlockedUser } from "@/lib/social";
import { signPhotos } from "@/lib/discover";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/blocked")({
  ssr: false,
  head: () => ({ meta: [{ title: "Blocați — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: BlockedPage,
});

function BlockedPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BlockedUser[]>([]);
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
        const list = await listBlocked();
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

  async function handleUnblock(id: string) {
    if (!confirm("Deblochezi acest utilizator?")) return;
    try {
      await unblock(id);
      setRows((r) => r.filter((x) => x.blocked_id !== id));
      toast.success("Deblocat");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <ShieldOff className="size-4 text-destructive" /> Utilizatori blocați
        </h1>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
      </header>

      <div className="mx-auto max-w-md px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            Nu ai blocat pe nimeni.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const photo = r.photos?.[0];
              const photoUrl = photo ? urls[photo] : null;
              return (
                <li key={r.blocked_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-full bg-background">
                    {photoUrl ? (
                      <img src={photoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-sm text-muted-foreground">
                        {r.display_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.display_name ?? "Anonim"}</p>
                    <p className="text-[10px] text-muted-foreground">Blocat {new Date(r.created_at).toLocaleDateString("ro-RO")}</p>
                  </div>
                  <button
                    onClick={() => handleUnblock(r.blocked_id)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-background"
                  >
                    Deblochează
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
