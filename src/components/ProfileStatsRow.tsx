import { useEffect, useState } from "react";
import { Eye, Hand, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function ProfileStatsRow({ userId }: { userId: string }) {
  const [stats, setStats] = useState({ views: 0, taps: 0, matches: 0 });

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [views, taps, matches] = await Promise.all([
        supabase.from("profile_views").select("id", { count: "exact", head: true }).eq("viewed_id", userId).gte("viewed_at", since),
        supabase.from("taps").select("id", { count: "exact", head: true }).eq("receiver_id", userId).gte("created_at", since),
        supabase.from("matches").select("id", { count: "exact", head: true }).or(`user_a.eq.${userId},user_b.eq.${userId}`),
      ]);
      setStats({
        views: views.count ?? 0,
        taps: taps.count ?? 0,
        matches: matches.count ?? 0,
      });
    })();
  }, [userId]);

  return (
    <div className="grid grid-cols-3 gap-3">
      <Link to="/visitors" className="rounded-2xl border border-border bg-surface p-4 text-center hover:border-primary/50">
        <Eye className="mx-auto size-5 text-primary" />
        <p className="mt-2 font-display text-xl">{stats.views}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vizualizări 7z</p>
      </Link>
      <div className="rounded-2xl border border-border bg-surface p-4 text-center">
        <Hand className="mx-auto size-5 text-primary" />
        <p className="mt-2 font-display text-xl">{stats.taps}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Taps</p>
      </div>
      <Link to="/messages" className="rounded-2xl border border-border bg-surface p-4 text-center hover:border-primary/50">
        <Sparkles className="mx-auto size-5 text-primary" />
        <p className="mt-2 font-display text-xl">{stats.matches}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Match-uri</p>
      </Link>
    </div>
  );
}
