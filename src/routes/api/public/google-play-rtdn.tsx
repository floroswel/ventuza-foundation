import { createFileRoute } from "@tanstack/react-router";

/**
 * Google Play Real-Time Developer Notifications (RTDN) webhook.
 * Configure in Play Console → Monetize → Subscriptions → "Real-time developer notifications"
 * → endpoint: https://suzeta.app/api/public/google-play-rtdn?token=<GOOGLE_PLAY_RTDN_SECRET>
 *
 * SECURITATE: payload-ul Pub/Sub NU este de încredere. Cererea trebuie să
 * poarte secretul partajat (query `token` sau header `x-rtdn-secret`).
 * Fără secret configurat/valid, endpointul refuză (fail-closed) și nu scrie
 * nimic în `subscriptions`. Notificarea este doar un semnal: starea reală se
 * re-verifică server-side prin Android Publisher API.
 */

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/google-play-rtdn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.GOOGLE_PLAY_RTDN_SECRET;
        if (!expected) {
          console.error("[RTDN] GOOGLE_PLAY_RTDN_SECRET missing — refusing");
          return new Response("not_configured", { status: 503 });
        }
        const url = new URL(request.url);
        const provided =
          url.searchParams.get("token") ??
          request.headers.get("x-rtdn-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!provided || !timingSafeEqual(provided, expected)) {
          console.warn("[RTDN] rejected unauthenticated notification");
          return new Response("unauthorized", { status: 401 });
        }

        try {
          const body = await request.json();
          // Pub/Sub envelope: { message: { data: base64, messageId, publishTime }, subscription }
          const dataB64 = body?.message?.data;
          if (!dataB64) return new Response("ok", { status: 200 });

          const decoded = JSON.parse(Buffer.from(dataB64, "base64").toString("utf-8"));
          const notif = decoded?.subscriptionNotification ?? decoded?.oneTimeProductNotification;
          if (!notif) return new Response("ok", { status: 200 });

          const purchaseToken: string = notif.purchaseToken;
          const productId: string = notif.subscriptionId ?? notif.sku ?? "";
          const notifType: number = notif.notificationType;
          if (!purchaseToken || typeof purchaseToken !== "string") {
            return new Response("ok", { status: 200 });
          }

          // Re-verifică starea reală la Google în loc să ai încredere în payload.
          const { verifyGooglePlayPurchase } = await import("@/lib/google-play.server");
          let status: "active" | "inactive";
          try {
            const verified = await verifyGooglePlayPurchase({ productId, purchaseToken });
            status = verified.valid ? "active" : "inactive";

          } catch (e) {
            console.error("[RTDN] purchase re-verification failed:", e);
            return new Response("ok", { status: 200 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status,
              raw: decoded as never,
              updated_at: new Date().toISOString(),
            })
            .eq("platform", "google_play")
            .eq("purchase_token", purchaseToken);

          console.log(
            `[RTDN] ${productId} token=${purchaseToken.slice(0, 12)}… type=${notifType} → ${status}`,
          );
          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("[RTDN] error:", err);
          // 200 pentru a nu declanșa retry-spam Pub/Sub; erorile sunt logate.
          return new Response("ok", { status: 200 });
        }
      },
    },
  },
});
