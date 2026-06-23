import { useEffect, useState } from "react";
import { Flame, Gift, Loader2, Sparkles, Zap, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  claimDailyReward,
  fetchGamification,
  rewardLabel,
  type GamificationState,
} from "@/lib/gamification";

const REWARD_DAYS = [
  { kind: "super_taps", amount: 1, label: "1 Super Tap" },
  { kind: "xp", amount: 0, label: "+40 XP" },
  { kind: "super_taps", amount: 2, label: "2 Super Taps" },
  { kind: "xp", amount: 0, label: "+60 XP" },
  { kind: "boost", amount: 1, label: "1 Boost" },
  { kind: "super_taps", amount: 3, label: "3 Super Taps" },
  { kind: "boost", amount: 2, label: "2 Boost-uri 🎁" },
] as const;

export function DailyRewardCard() {
  const [state, setState] = useState<GamificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchGamification().then((g) => {
      if (alive) {
        setState(g);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleClaim() {
    if (!state || state.claimed_today || claiming) return;
    setClaiming(true);
    try {
      const res = await claimDailyReward();
      toast.success(`🔥 Ziua ${res.streak} — ai primit ${rewardLabel(res.reward_kind, res.reward_amount)} + ${res.xp} XP`);
      const fresh = await fetchGamification();
      setState(fresh);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare";
      if (msg.includes("already_claimed")) {
        toast.info("Recompensa de azi a fost deja revendicată.");
      } else {
        toast.error(msg);
      }
    } finally {
      setClaiming(false);
    }
  }

  if (loading || !state) return null;
  if (state.claimed_today) return null;

  const nextDay = Math.min(7, ((state.streak_days) % 7) + 1);
  const xpInLevel = state.xp - state.level_xp_start;
  const xpForNext = state.level_xp_end - state.level_xp_start;
  const pct = Math.min(100, Math.round((xpInLevel / Math.max(1, xpForNext)) * 100));

  return (
    <div className="mx-3 mt-2 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-fuchsia-500/15 p-3 shadow-[0_8px_24px_-12px_rgba(244,114,182,0.5)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 shadow-[0_0_16px_rgba(251,191,36,0.5)]">
            <Flame className="size-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">
              {state.streak_days > 0 ? `Streak: ${state.streak_days} zile` : "Începe-ți streak-ul azi"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Lvl {state.level} · {xpInLevel}/{xpForNext} XP
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 font-medium">
            <Zap className="size-3 text-amber-400" /> {state.super_taps_balance}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 font-medium">
            <Sparkles className="size-3 text-fuchsia-400" /> {state.boosts_balance}
          </span>
        </div>
      </div>

      {/* XP bar */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Day chips */}
      <div className="mt-3 grid grid-cols-7 gap-1">
        {REWARD_DAYS.map((d, i) => {
          const dayNum = i + 1;
          const cycleDay = ((state.streak_days - 1) % 7) + 1;
          const isClaimed = state.claimed_today ? dayNum <= cycleDay : dayNum < cycleDay;
          const isNext = !state.claimed_today && dayNum === nextDay;
          return (
            <div
              key={i}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[9px]",
                isClaimed
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : isNext
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/50"
                    : "border-border/40 bg-background/30 text-muted-foreground",
              )}
            >
              <span className="font-bold">D{dayNum}</span>
              {d.kind === "boost" ? (
                <Sparkles className="size-3" />
              ) : d.kind === "super_taps" ? (
                <Zap className="size-3" />
              ) : (
                <Star className="size-3" />
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={state.claimed_today || claiming}
        onClick={handleClaim}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
          state.claimed_today
            ? "bg-background/40 text-muted-foreground"
            : "bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 text-white shadow-[0_4px_16px_-4px_rgba(244,114,182,0.6)] hover:brightness-110 active:scale-[0.98]",
        )}
      >
        {claiming ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state.claimed_today ? (
          <>✓ Revino mâine pentru ziua {nextDay}</>
        ) : (
          <>
            <Gift className="size-4" /> Revendică ziua {nextDay}
          </>
        )}
      </button>
    </div>
  );
}
