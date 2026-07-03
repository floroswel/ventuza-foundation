/**
 * Partner broadcasts — server functions.
 *
 * Toată logica critică e în DB (RPC `partner_send_broadcast` +
 * `partner_broadcast_quota_status` + `partner_list_my_broadcasts`):
 *   - verifică plan activ non-Free,
 *   - verifică venue owner + aprobat,
 *   - respectă opt-in-ul user-ilor (`partner_announcements_enabled`),
 *   - respectă cooldown 24h per user, cap total 5000/mesaj,
 *   - respectă cota săptămânală per plan (config în `app_settings.partner_broadcast_quotas`).
 *
 * Aceste server-fn-uri sunt doar wrappers subțiri peste RPC-uri, prin
 * `requireSupabaseAuth` (RLS ca userul).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendSchema = z.object({
  title: z.string().min(4).max(80),
  body: z.string().min(10).max(280),
  targetKind: z.enum(["online", "nearby", "followers", "city"]),
  venueId: z.string().uuid().optional().nullable(),
  radiusM: z.number().int().min(250).max(10000).optional(),
  city: z.string().max(80).optional().nullable(),
  deepLink: z.string().max(200).optional().nullable(),
});

export const partnerSendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof SendSchema>) => SendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: result, error } = await sb.rpc("partner_send_broadcast", {
      p_title: data.title,
      p_body: data.body,
      p_target_kind: data.targetKind,
      p_venue_id: data.venueId ?? null,
      p_radius_m: data.radiusM ?? 10000,
      p_city: data.city ?? null,
      p_deep_link: data.deepLink ?? null,
    });
    if (error) throw new Error(error.message);
    return result as {
      ok: boolean;
      broadcast_id: string;
      recipients: number;
      remaining: number;
    };
  });

export const partnerBroadcastQuotaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("partner_broadcast_quota_status");
    if (error) throw new Error(error.message);
    return data as {
      plan_code: string;
      active: boolean;
      weekly_cap: number;
      used_7d: number;
      remaining: number;
      max_radius_m: number;
      max_recipients_per_send: number;
      min_body_len: number;
      max_body_len: number;
      min_title_len: number;
      max_title_len: number;
      user_cooldown_hours: number;
    };
  });

export const partnerListMyBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("partner_list_my_broadcasts", { _limit: 50 });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      venue_id: string | null;
      title: string;
      body: string;
      target_kind: string;
      radius_m: number | null;
      city: string | null;
      recipients_delivered: number;
      recipients_targeted: number;
      status: string;
      created_at: string;
      sent_at: string | null;
    }>;
  });

/** Listez venue-urile aprobate ale partenerului pentru dropdown-ul de trimitere. */
export const partnerListApprovedVenues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("venues")
      .select("id, name, city, moderation_status, is_published")
      .eq("owner_id", context.userId)
      .eq("moderation_status", "approved")
      .eq("is_published", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; name: string; city: string | null }>;
  });
