import { supabase } from "@/integrations/supabase/client";

export type Quest = {
  id: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  xp_reward: number;
  bonus_kind: string | null;
  bonus_amount: number | null;
  icon: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string | null;
  photo_url: string | null;
  level: number;
  weekly_xp: number;
  streak_days: number;
  rank: number;
};

export async function fetchMyQuests(): Promise<Quest[]> {
  const { data, error } = await supabase.rpc("get_my_quests");
  if (error) throw error;
  return (data ?? []) as unknown as Quest[];
}

export async function claimQuestReward(questId: string) {
  const { data, error } = await supabase.rpc("claim_quest_reward", { _quest_id: questId });
  if (error) throw error;
  return data;
}

export async function fetchLocalLeaderboard(radiusKm = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_local_leaderboard", { _radius_km: radiusKm });
  if (error) throw error;
  return (data ?? []) as unknown as LeaderboardRow[];
}
