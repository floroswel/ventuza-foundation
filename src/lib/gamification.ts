import { supabase } from "@/integrations/supabase/client";

export type GamificationState = {
  xp: number;
  level: number;
  level_xp_start: number;
  level_xp_end: number;
  streak_days: number;
  last_check_in_at: string | null;
  boosts_balance: number;
  super_taps_balance: number;
  claimed_today: boolean;
};

export type DailyRewardResult = {
  streak: number;
  reward_kind: "xp" | "super_taps" | "boost";
  reward_amount: number;
  xp: number;
};

export async function fetchGamification(): Promise<GamificationState | null> {
  const { data, error } = await supabase.rpc("get_my_gamification");
  if (error) return null;
  return data as unknown as GamificationState;
}

export async function claimDailyReward(): Promise<DailyRewardResult> {
  const { data, error } = await supabase.rpc("claim_daily_reward");
  if (error) throw error;
  return data as unknown as DailyRewardResult;
}

export function rewardLabel(kind: DailyRewardResult["reward_kind"], amount: number): string {
  switch (kind) {
    case "boost":
      return amount > 1 ? `${amount} Boost-uri` : "1 Boost";
    case "super_taps":
      return amount > 1 ? `${amount} Super Taps` : "1 Super Tap";
    case "xp":
      return "Bonus XP";
  }
}
