import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { recordGooglePlayPurchase } from "@/lib/account.functions";

/**
 * Detect native Capacitor runtime (Android APK). On web returns false.
 * Uses dynamic import so the web bundle never tries to require Capacitor at SSR.
 */
async function getPlatform(): Promise<"web" | "android" | "ios"> {
  if (typeof window === "undefined") return "web";
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return "web";
    return Capacitor.getPlatform() as "android" | "ios";
  } catch {
    return "web";
  }
}

export type PremiumStatus = {
  isPremium: boolean;
  expiresAt: string | null;
  loading: boolean;
  platform: "web" | "android" | "ios";
};

/**
 * Hook: returns current Premium status + a `purchase(productId)` action.
 * - Reads `subscriptions` table (status='active' AND expires_at > now()).
 * - On Android: calls RevenueCat → on success POSTs token to server fn for
 *   double-validation, then refetches status.
 * - On web: `purchase()` throws — UI should hide native CTAs and show
 *   "Disponibil în aplicația Android" instead.
 */
export function usePremium() {
  const { user } = useAuth();
  const record = useServerFn(recordGooglePlayPurchase);
  const [status, setStatus] = useState<PremiumStatus>({
    isPremium: false,
    expiresAt: null,
    loading: true,
    platform: "web",
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus((s) => ({ ...s, isPremium: false, expiresAt: null, loading: false }));
      return;
    }
    const platform = await getPlatform();
    const { data } = await supabase
      .from("subscriptions")
      .select("status,expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const active =
      !!data &&
      data.status === "active" &&
      (!data.expires_at || new Date(data.expires_at) > new Date());

    setStatus({
      isPremium: active,
      expiresAt: data?.expires_at ?? null,
      loading: false,
      platform,
    });
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const purchase = useCallback(
    async (productId: string) => {
      const platform = await getPlatform();
      if (platform !== "android") {
        throw new Error("Premium este disponibil deocamdată doar în aplicația Android.");
      }
      const { Purchases } = await import("@revenuecat/purchases-capacitor");

      const offerings = await Purchases.getOfferings();
      const all = offerings.all ?? {};
      let pkg = null as unknown as Awaited<ReturnType<typeof Purchases.getOfferings>>["current"] extends infer C
        ? C extends { availablePackages: Array<infer P> } ? P : null
        : null;
      for (const off of Object.values(all)) {
        const found = off.availablePackages.find((p) => p.product.identifier === productId);
        if (found) { pkg = found as never; break; }
      }
      if (!pkg) throw new Error(`Produsul ${productId} nu există în RevenueCat.`);

      const result = await Purchases.purchasePackage({ aPackage: pkg as never });
      const token =
        (result as unknown as { transaction?: { transactionIdentifier?: string } }).transaction
          ?.transactionIdentifier ?? "";

      await record({ data: { productId, purchaseToken: token } });
      await refresh();
    },
    [record, refresh],
  );

  const restore = useCallback(async () => {
    const platform = await getPlatform();
    if (platform !== "android") return;
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.restorePurchases();
    await refresh();
  }, [refresh]);

  return { ...status, refresh, purchase, restore };
}
