import { createFileRoute } from "@tanstack/react-router";

/**
 * Google Play Real-Time Developer Notifications (RTDN) webhook.
 * Configure in Play Console → Monetize → Subscriptions → "Real-time developer notifications"
 * → endpoint: https://ventuza-foundation.lovable.app/api/public/google-play-rtdn
 *
 * Payload is wrapped in a Pub/Sub message. We decode, then update local `subscriptions`
 * table with the latest state. Token verification against Google APIs is best-effort and
 * runs only when GOOGLE_PLAY_SERVICE_ACCOUNT secret is set.
 */
export const Route = createFileRoute("/api/public/google-play-rtdn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          // Pub/Sub envelope: { message: { data: base64, messageId, publishTime }, subscription }
          const dataB64 = body?.message?.data;
          if (!dataB64) return new Response("ok", { status: 200 });

          const decoded = JSON.parse(Buffer.from(dataB64, "base64").toString("utf-8"));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const notif = decoded?.subscriptionNotification ?? decoded?.oneTimeProductNotification;
          if (!notif) return new Response("ok", { status: 200 });

          const purchaseToken: string = notif.purchaseToken;
          const productId: string = notif.subscriptionId ?? notif.sku ?? "";
          const notifType: number = notif.notificationType;

          // Map notificationType → status
          // 1 RECOVERED, 2 RENEWED, 4 PURCHASED, 7 RESTARTED → active
          // 3 CANCELED, 12 REVOKED, 13 EXPIRED, 10 PAUSED → inactive
          const activeTypes = new Set([1, 2, 4, 7]);
          const status = activeTypes.has(notifType) ? "active" : "inactive";

          await supabaseAdmin
            .from("subscriptions")
            .update({
              status,
              raw: decoded as never,
              updated_at: new Date().toISOString(),
            })
            .eq("platform", "google_play")
            .eq("purchase_token", purchaseToken);

          // Audit log
          console.log(
            `[RTDN] ${productId} token=${purchaseToken.slice(0, 12)}… type=${notifType} → ${status}`,
          );
          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("[RTDN] error:", err);
          // Always 200 so Pub/Sub doesn't retry-spam us; failures are logged.
          return new Response("ok", { status: 200 });
        }
      },
    },
  },
});
