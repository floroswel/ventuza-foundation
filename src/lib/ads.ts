import { supabase } from "@/integrations/supabase/client";

export type AdPlacement = "events_banner" | "discover_card" | "event_boost";

export type AdCampaign = {
  id: string;
  advertiser_id: string;
  placement: AdPlacement;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  target_event_id: string | null;
  city: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
};

export type Advertiser = {
  id: string;
  owner_id: string;
  brand_name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  category: string;
  verified: boolean;
  created_at: string;
};

export async function fetchActiveAds(placement: AdPlacement, city?: string, limit = 3): Promise<AdCampaign[]> {
  let q = supabase
    .from("ad_campaigns")
    .select("id, advertiser_id, placement, title, body, image_url, cta_label, cta_url, target_event_id, city, status, starts_at, ends_at")
    .eq("placement", placement)
    .eq("status", "active")
    .lte("starts_at", new Date().toISOString())
    .gt("ends_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (city) q = q.or(`city.is.null,city.ilike.%${city}%`);
  const { data } = await q;
  return (data ?? []) as AdCampaign[];
}

export async function trackAd(campaignId: string, kind: "impression" | "click") {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("ad_events").insert({
    campaign_id: campaignId,
    user_id: u.user?.id ?? null,
    kind,
  });
}

export async function getMyAdvertiser(): Promise<Advertiser | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("advertisers")
    .select("*")
    .eq("owner_id", u.user.id)
    .maybeSingle();
  return (data as Advertiser | null) ?? null;
}

export async function listMyCampaigns(advertiserId: string): Promise<AdCampaign[]> {
  const { data } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("advertiser_id", advertiserId)
    .order("created_at", { ascending: false });
  return (data ?? []) as AdCampaign[];
}

// Woof (Scruff-style)
export async function sendWoof(receiverId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const { error } = await supabase
    .from("woofs")
    .insert({ sender_id: u.user.id, receiver_id: receiverId });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function hasWoofed(receiverId: string): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data } = await supabase
    .from("woofs")
    .select("id")
    .eq("sender_id", u.user.id)
    .eq("receiver_id", receiverId)
    .maybeSingle();
  return !!data;
}
