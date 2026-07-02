/**
 * Anulare abonament RevenueCat server-to-server.
 *
 * Folosit la ștergerea contului (GDPR Art. 17) ca să nu mai fie taxat
 * utilizatorul după ce contul nu mai există.
 *
 * Secret necesar (de adăugat în Lovable → Project Settings → Secrets):
 *   REVENUECAT_SECRET_API_KEY  → cheia "v2 secret" din
 *     RevenueCat dashboard → Project Settings → API Keys → "Secret API keys".
 *     Trebuie să fie cheia "secret" (sk_...), NU "public" (appl_.../goog_...).
 *
 * Docs: https://www.revenuecat.com/docs/api-v2 (Customers → Delete / Subscriptions → Cancel)
 *
 * Strategia aleasă: DELETE customer — șterge complet customer-ul din RC și
 * marchează abonamentele active drept anulate (nu se mai reînnoiesc). Pentru
 * Google Play / App Store, store-ul rămâne sursa de adevăr; RC nu poate
 * forța refund acolo, dar opreşte tracking-ul + webhook-urile.
 */

export type RevenueCatCancelResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
};

export async function cancelRevenueCatForUser(appUserId: string): Promise<RevenueCatCancelResult> {
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) {
    return {
      ok: false,
      skipped: true,
      reason:
        "REVENUECAT_SECRET_API_KEY lipsește — adaugă-l în Lovable Secrets (RevenueCat → Project Settings → API Keys → Secret API keys).",
    };
  }
  if (!appUserId) return { ok: false, reason: "appUserId gol" };

  try {
    // RevenueCat REST v1 — "Delete subscriber" îndepărtează customer-ul.
    // Endpoint: DELETE https://api.revenuecat.com/v1/subscribers/{app_user_id}
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
    );

    if (res.status === 200 || res.status === 204 || res.status === 404) {
      // 404 = nu există în RC (user fără achiziție) → tratăm ca succes.
      return { ok: true, status: res.status };
    }

    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      reason: `RevenueCat DELETE eșuat (${res.status}): ${body.slice(0, 200)}`,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Eroare rețea RevenueCat",
    };
  }
}
