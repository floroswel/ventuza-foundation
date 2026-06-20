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

    // Best-effort: remove storage files first
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

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Verify a Google Play purchase token server-side.
 * Stub: when GOOGLE_PLAY_SERVICE_ACCOUNT secret is configured, this will call
 * androidpublisher.purchases.subscriptions.get and persist the result.
 * For now records pending row so UI can show "verification in progress".
 */
export const recordGooglePlayPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { productId: string; purchaseToken: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const serviceAccount = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
    let status: "pending" | "active" = "pending";
    let expiresAt: string | null = null;
    let raw: unknown = null;

    if (serviceAccount) {
      // TODO: full implementation with google-auth-library + androidpublisher API
      // Left as `pending` until service account is provided & wired.
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

    return { status };
  });
