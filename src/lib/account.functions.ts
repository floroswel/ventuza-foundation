import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently delete the signed-in user's account (GDPR).
 * Deletes auth.users → cascades to profiles, matches, messages, etc.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // GDPR Art. 17 — anulăm explicit abonamentul RevenueCat ÎNAINTE de a
    // șterge contul, ca să nu mai fie taxat utilizatorul. Eșecul nu blochează
    // ștergerea (loggăm în deletion_requests.reason pentru audit).
    let rcNote = "";
    try {
      const { cancelRevenueCatForUser } = await import("./revenuecat.server");
      const rc = await cancelRevenueCatForUser(context.userId);
      rcNote = rc.ok
        ? `revenuecat=ok(${rc.status ?? "200"})`
        : `revenuecat=fail:${rc.reason ?? "unknown"}`;
    } catch (e) {
      rcNote = `revenuecat=throw:${e instanceof Error ? e.message : "?"}`;
    }

    // Best-effort: ștergem fișierele din storage (cascade nu acoperă storage).
    try {
      const { data: files } = await supabaseAdmin.storage
        .from("profile-photos")
        .list(context.userId);
      if (files && files.length) {
        await supabaseAdmin.storage
          .from("profile-photos")
          .remove(files.map((f) => `${context.userId}/${f.name}`));
      }
    } catch {
      // ignore cleanup errors
    }

    // Audit trail (după RC, ca să prindem și rezultatul anulării).
    try {
      await supabaseAdmin.from("deletion_requests").insert({
        user_id: context.userId,
        requested_at: new Date().toISOString(),
        scheduled_for: new Date().toISOString(),
        reason: `user_self_service; ${rcNote}`,
        status: "processed",
        processed_at: new Date().toISOString(),
      });
    } catch {
      // Continuăm chiar dacă log-ul eșuează — dreptul la ștergere prevalează.
    }

    // Cascade către profiles, swipes, matches, messages, subscriptions etc.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Verify a Google Play purchase token server-side and persist the subscription.
 *
 * Folosește Android Publisher API v3 prin JWT RS256 semnat cu Web Crypto
 * (Cloudflare Workers-compatible). Vezi `src/lib/google-play.server.ts`.
 */
export const recordGooglePlayPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { productId: string; purchaseToken: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyGooglePlayPurchase } = await import("./google-play.server");

    let status: "pending" | "active" | "expired" | "cancelled" = "pending";
    let expiresAt: string | null = null;
    let raw: unknown = null;
    let message: string | undefined;

    try {
      const result = await verifyGooglePlayPurchase({
        productId: data.productId,
        purchaseToken: data.purchaseToken,
      });
      raw = result.raw;
      if (result.valid) {
        status = "active";
        expiresAt =
          result.expiresAt ??
          // One-time produs: derivăm o expirare convențională (1 an monthly = N/A,
          // dar pentru one-time setăm 100 ani ca să nu expire).
          new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        status = "pending";
        message = result.reason ?? "Verificare eșuată";
      }
    } catch (e) {
      status = "pending";
      message = e instanceof Error ? e.message : "Eroare verificare Google Play";
    }

    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        platform: "google_play",
        product_id: data.productId,
        purchase_token: data.purchaseToken,
        status,
        expires_at: expiresAt,
        raw: raw as never,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform,purchase_token" },
    );
    if (error) throw new Error(error.message);

    return { success: status === "active", status, expiresAt, message };
  });



/**
 * GDPR Right to Data Portability — export all user data as JSON.
 */
export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, swipes, matches, messages, events, rsvps, subs, notifications] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("swipes").select("*").eq("swiper_id", userId),
        supabase.from("matches").select("*").or(`user_a.eq.${userId},user_b.eq.${userId}`),
        supabase.from("messages").select("*").eq("sender_id", userId),
        supabase.from("events").select("*").eq("host_id", userId),
        supabase.from("event_rsvps").select("*").eq("user_id", userId),
        supabase.from("subscriptions").select("*").eq("user_id", userId),
        supabase.from("notifications").select("*").eq("user_id", userId),
      ]);
    return JSON.parse(JSON.stringify({
      exported_at: new Date().toISOString(),
      user_id: userId,
      profile: profile.data,
      swipes: swipes.data ?? [],
      matches: matches.data ?? [],
      messages_sent: messages.data ?? [],
      events_hosted: events.data ?? [],
      event_rsvps: rsvps.data ?? [],
      subscriptions: subs.data ?? [],
      notifications: notifications.data ?? [],
    })) as { exported_at: string; user_id: string };
  });
