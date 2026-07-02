import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { getOrCreateConversation } from "@/lib/chat";
import { toast } from "sonner";

export const Route = createFileRoute("/visitors")({
  head: () => ({ meta: [{ title: "Visitors — Ventuza" }] }),
  component: VisitorsPage,
});

type Visitor = {
  viewer_id: string;
  last_viewed_at: string;
  view_count: number;
  display_name: string | null;
  photo: string | null;
  age: number | null;
};

async function signPhoto(p: string | null): Promise<string | null> {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
  return data?.signedUrl ?? null;
}

function age(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

function fmt(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = 60_000,
    h = 60 * m,
    day = 24 * h;
  if (diff < h) return `${Math.max(1, Math.floor(diff / m))}m ago`;
  if (diff < day) return `${Math.floor(diff / h)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString();
}

function VisitorsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const { data: views, error } = await supabase
          .from("profile_views")
          .select("viewer_id, viewed_at")
          .eq("viewed_id", user.id)
          .order("viewed_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        const rows = (views ?? []) as Array<{ viewer_id: string; viewed_at: string }>;

        // dedupe by viewer
        const map = new Map<string, { last: string; count: number }>();
        for (const r of rows) {
          if (r.viewer_id === user.id) continue;
          const cur = map.get(r.viewer_id);
          if (!cur) map.set(r.viewer_id, { last: r.viewed_at, count: 1 });
          else cur.count += 1;
        }
        const ids = Array.from(map.keys());
        if (ids.length === 0) {
          if (alive) {
            setVisitors([]);
            setLoading(false);
          }
          return;
        }

        const { data: profs, error: pErr } = await supabase.rpc("get_public_profiles", {
          _ids: ids,
        });
        if (pErr) throw pErr;
        type Prow = {
          id: string;
          display_name: string | null;
          photos: string[] | null;
          birthdate: string | null;
        };
        const profMap = new Map<string, Prow>();
        for (const p of (profs ?? []) as Prow[]) profMap.set(p.id, p);

        const out: Visitor[] = [];
        for (const id of ids) {
          const info = map.get(id)!;
          const p = profMap.get(id);
          out.push({
            viewer_id: id,
            last_viewed_at: info.last,
            view_count: info.count,
            display_name: p?.display_name ?? null,
            photo: await signPhoto(p?.photos?.[0] ?? null),
            age: age(p?.birthdate),
          });
        }
        out.sort(
          (a, b) => new Date(b.last_viewed_at).getTime() - new Date(a.last_viewed_at).getTime(),
        );
        if (alive) setVisitors(out);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't load visitors");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-3 py-3 backdrop-blur">
        <Link
          to="/profile"
          className="rounded-full p-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Visitors</h1>
        <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {visitors.length}
        </span>
      </header>

      <div className="flex-1 px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : visitors.length === 0 ? (
          <EmptyState
            icon={Eye}
            title="Niciun vizitator încă"
            body="Când cineva îți vede profilul, va apărea aici."
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {visitors.map((v) => (
              <li
                key={v.viewer_id}
                className="group overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div className="relative aspect-[3/4] bg-muted">
                  {v.photo ? (
                    <img src={v.photo} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-3xl text-muted-foreground/40">
                      {(v.display_name ?? "?").slice(0, 1)}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                    <p className="truncate text-sm font-medium text-white">
                      {v.display_name ?? "Unknown"}
                      {v.age ? <span className="text-white/70">, {v.age}</span> : null}
                    </p>
                    <p className="text-[10px] text-white/60">
                      {fmt(v.last_viewed_at)} · {v.view_count} view{v.view_count > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const cid = await getOrCreateConversation(v.viewer_id);
                      navigate({ to: "/messages/$id", params: { id: cid } });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Couldn't open chat");
                    }
                  }}
                  className="block w-full px-3 py-2 text-center text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Message
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
