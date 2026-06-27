import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck, CalendarHeart, CircleCheck, CirclePlus, Compass, Crown, Flame,
  Gift, Hand, Heart, Loader2, MessageCircle, Sparkles, Trophy, Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { claimQuestReward, fetchLocalLeaderboard, fetchMyQuests, type LeaderboardRow, type Quest } from "@/lib/quests";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quests")({
  head: () => ({ meta: [{ title: "Quests & Leaderboard — Ventuza" }] }),
  component: QuestsPage,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "message-circle": MessageCircle, hand: Hand, compass: Compass, heart: Heart,
  "circle-plus": CirclePlus, "badge-check": BadgeCheck, calendar: CalendarHeart, sparkles: Sparkles,
};

function QuestsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"quests" | "leaderboard">("quests");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-5 py-4 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">Provocări</h1>
        <p className="text-xs text-muted-foreground">Câștigă XP, boost-uri și super-taps</p>
        <div className="mt-3 flex gap-2">
          <TabBtn active={tab === "quests"} onClick={() => setTab("quests")}>
            <Sparkles className="size-3.5" /> Quests
          </TabBtn>
          <TabBtn active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
            <Trophy className="size-3.5" /> Top local
          </TabBtn>
        </div>
      </header>

      <div className="flex-1 px-3 py-3">
        {tab === "quests" ? <QuestsList /> : <LeaderboardList />}
      </div>

      <BottomNav />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function QuestsList() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  async function load() {
    try { setError(null); setQuests(await fetchMyQuests()); }
    catch (e) { setError(e instanceof Error ? e.message : "Nu am putut încărca misiunile."); }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function claim(q: Quest) {
    if (q.claimed || !q.completed || claiming) return;
    setClaiming(q.id);
    try {
      await claimQuestReward(q.id);
      toast.success(`+${q.xp_reward} XP${q.bonus_kind ? ` · ${q.bonus_amount} ${q.bonus_kind === "boost" ? "Boost" : "Super Tap"}` : ""}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setClaiming(null);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  if (error) return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center">
      <p className="text-sm font-medium text-destructive">Nu am putut încărca misiunile</p>
      <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      <button onClick={() => { setLoading(true); void load(); }} className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
        Reîncearcă
      </button>
    </div>
  );
  if (quests.length === 0) return (
    <div className="px-3 py-12 text-center text-sm text-muted-foreground">
      Săptămâna aceasta nu sunt misiuni active. Revino luni.
    </div>
  );


  return (
    <div className="space-y-2">
      <p className="px-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Săptămâna aceasta · resetare luni</p>
      {quests.map((q) => {
        const Icon = ICONS[q.icon] ?? Sparkles;
        const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
        return (
          <div
            key={q.id}
            className={cn(
              "rounded-2xl border p-3 transition-colors",
              q.claimed
                ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
                : q.completed
                  ? "border-amber-500/50 bg-amber-500/10 shadow-[0_0_16px_-6px_rgba(251,191,36,0.4)]"
                  : "border-border/60 bg-card/40",
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                q.claimed ? "bg-emerald-500/20 text-emerald-300"
                  : q.completed ? "bg-amber-500/20 text-amber-300"
                  : "bg-muted text-muted-foreground",
              )}>
                {q.claimed ? <CircleCheck className="size-5" /> : <Icon className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{q.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{q.description}</p>
              </div>
              <div className="text-right text-[10px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 font-medium">
                  <Sparkles className="size-3 text-amber-400" />+{q.xp_reward}
                </span>
                {q.bonus_kind && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 font-medium">
                    {q.bonus_kind === "boost" ? <Sparkles className="size-3 text-fuchsia-400" /> : <Zap className="size-3 text-amber-400" />}
                    {q.bonus_amount}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
              <div
                className={cn(
                  "h-full transition-[width]",
                  q.claimed ? "bg-emerald-500" : q.completed ? "bg-gradient-to-r from-amber-400 to-rose-500" : "bg-primary/60",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{q.progress}/{q.target}</span>
              {q.completed && !q.claimed ? (
                <button
                  disabled={claiming === q.id}
                  onClick={() => claim(q)}
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-3 py-1 text-[11px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(244,114,182,0.5)] active:scale-95"
                >
                  {claiming === q.id ? <Loader2 className="size-3 animate-spin" /> : <Gift className="size-3" />}
                  Revendică
                </button>
              ) : q.claimed ? (
                <span className="text-[10px] font-medium text-emerald-400">✓ Revendicat</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeaderboardList() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchLocalLeaderboard(50);
        if (alive) setRows(data);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Eroare");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  if (error) return <p className="px-3 py-6 text-center text-sm text-muted-foreground">{error}</p>;
  if (rows.length === 0) return (
    <div className="px-3 py-12 text-center">
      <Trophy className="mx-auto size-10 text-muted-foreground/40" />
      <p className="mt-3 text-sm font-medium">Niciun rival în zonă încă</p>
      <p className="mt-1 text-xs text-muted-foreground">Activează locația și fii primul care intră în top.</p>
    </div>
  );

  return (
    <div className="space-y-1.5">
      <p className="px-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Top 20 · rază 50 km · XP săptămâna aceasta</p>
      {rows.map((r) => (
        <div
          key={r.user_id}
          className={cn(
            "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
            r.rank <= 3 ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-rose-500/10" : "border-border/50 bg-card/30",
          )}
        >
          <div className={cn(
            "flex size-8 items-center justify-center rounded-full text-sm font-bold",
            r.rank === 1 ? "bg-amber-400 text-black"
            : r.rank === 2 ? "bg-zinc-300 text-black"
            : r.rank === 3 ? "bg-orange-400 text-black"
            : "bg-muted text-muted-foreground",
          )}>
            {r.rank <= 3 ? <Crown className="size-4" /> : r.rank}
          </div>
          <div className="size-10 shrink-0 overflow-hidden rounded-full bg-muted">
            {r.photo_url ? <img src={r.photo_url} alt="" className="size-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{r.display_name ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">Lvl {r.level} · 🔥 {r.streak_days}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-amber-300">{r.weekly_xp}</p>
            <p className="text-[10px] text-muted-foreground">XP</p>
          </div>
        </div>
      ))}
    </div>
  );
}
