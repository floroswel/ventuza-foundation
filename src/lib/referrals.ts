import { supabase } from "@/integrations/supabase/client";

export async function getMyReferralCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc("ensure_referral_code");
  if (error) { console.error(error); return null; }
  return data as string;
}

export async function redeemReferral(code: string): Promise<{ ok: boolean; error?: string; reward_xp?: number }> {
  const { data, error } = await supabase.rpc("redeem_referral", { _code: code });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string; reward_xp?: number };
}

export function referralLink(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://ventuza-foundation.lovable.app";
  return `${origin}/?ref=${code}`;
}
