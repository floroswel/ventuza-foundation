/**
 * Server functions for advertiser onboarding and ad campaigns.
 * Replaces the direct `.insert()` calls from business.dashboard.tsx so we can
 * (a) validate input server-side, (b) keep a single audit trail, and
 * (c) prevent privilege escalation on advertisers.owner_id.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AdvertiserInput = z.object({
  brand_name: z.string().trim().min(2).max(120),
  contact_email: z.string().trim().email().max(200),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().url().max(200).optional().nullable(),
  category: z.enum(["venue", "event", "brand", "ngo", "service"]),
});

export const createAdvertiser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdvertiserInput.parse(d))
  .handler(async ({ data, context }) => {
    // Caller must hold the 'business' or 'admin' role.
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r) => r.role === "business" || r.role === "admin");
    if (!ok) throw new Error("Acces rezervat partenerilor aprobați.");

    const { data: row, error } = await context.supabase
      .from("advertisers")
      .insert({
        owner_id: context.userId,
        brand_name: data.brand_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone ?? null,
        website: data.website ?? null,
        category: data.category,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const PLACEMENT_PRICES: Record<string, { perDayEur: number; minDays: number }> = {
  events_banner: { perDayEur: 15, minDays: 3 },
  discover_card: { perDayEur: 25, minDays: 3 },
  event_boost: { perDayEur: 10, minDays: 1 },
};

const CampaignInput = z.object({
  advertiser_id: z.string().uuid(),
  placement: z.enum(["events_banner", "discover_card", "event_boost"]),
  title: z.string().trim().min(2).max(60),
  body: z.string().trim().max(140).optional().nullable(),
  image_url: z.string().trim().url().max(500).optional().nullable(),
  cta_label: z.string().trim().max(40).default("Află mai mult"),
  cta_url: z.string().trim().url().max(500).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
});

export const createAdCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CampaignInput.parse(d))
  .handler(async ({ data, context }) => {
    // Ownership check — RLS would catch it too, but fail fast with a clear message.
    const { data: adv } = await context.supabase
      .from("advertisers").select("owner_id").eq("id", data.advertiser_id).maybeSingle();
    if (!adv || adv.owner_id !== context.userId) throw new Error("Nu ai acces la acest brand.");

    const startMs = new Date(data.starts_at).getTime();
    const endMs = new Date(data.ends_at).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw new Error("Interval invalid: data de sfârșit trebuie să fie după start.");
    }
    const days = Math.max(1, Math.ceil((endMs - startMs) / 86_400_000));
    const price = PLACEMENT_PRICES[data.placement];
    if (days < price.minDays) throw new Error(`Minim ${price.minDays} zile pentru acest placement.`);
    const budgetCents = days * price.perDayEur * 100;

    const { data: row, error } = await context.supabase
      .from("ad_campaigns")
      .insert({
        advertiser_id: data.advertiser_id,
        placement: data.placement,
        title: data.title,
        body: data.body ?? null,
        image_url: data.image_url ?? null,
        cta_label: data.cta_label,
        cta_url: data.cta_url ?? null,
        city: data.city ?? null,
        budget_cents: budgetCents,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endMs).toISOString(),
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
