// Server-only helper care încapsulează ștergerea completă a unui cont:
// RevenueCat cancel → storage cleanup → audit log → auth.admin.deleteUser
// (cascade FK către profiles/messages/swipes/matches etc.).
//
// Reutilizat de:
//   - src/lib/account.functions.ts → deleteMyAccount (self-service GDPR Art. 17)
//   - src/lib/admin-wave1.functions.ts → adminPurgeUserAccount (M13 GDPR ops)
//
// NU importa acest fișier dintr-un .functions.ts la nivel de modul — folosește
// `await import("./account.server")` în handler ca să nu se scurgă în bundle-ul
// client.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PurgeReason = "user_self_service" | "admin_gdpr" | "scheduled_purge";

export async function purgeUserAccount(
  userId: string,
  reason: PurgeReason,
  extra?: { actorId?: string; justification?: string },
): Promise<{ ok: true; rcNote: string }> {
  // 1) RevenueCat — anulare ÎNAINTE de ștergere (nu mai e taxat).
  let rcNote = "";
  try {
    const { cancelRevenueCatForUser } = await import("./revenuecat.server");
    const rc = await cancelRevenueCatForUser(userId);
    rcNote = rc.ok
      ? `revenuecat=ok(${rc.status ?? "200"})`
      : `revenuecat=fail:${rc.reason ?? "unknown"}`;
  } catch (e) {
    rcNote = `revenuecat=throw:${e instanceof Error ? e.message : "?"}`;
  }

  // 2) Storage cleanup (cascade FK nu acoperă obiectele din storage).
  try {
    const { data: files } = await supabaseAdmin.storage.from("profile-photos").list(userId);
    if (files && files.length) {
      await supabaseAdmin.storage
        .from("profile-photos")
        .remove(files.map((f) => `${userId}/${f.name}`));
    }
  } catch {
    /* best-effort */
  }

  // 3) Trace în deletion_requests (audit indiferent de calea aleasă).
  try {
    await supabaseAdmin.from("deletion_requests").insert({
      user_id: userId,
      requested_at: new Date().toISOString(),
      scheduled_for: new Date().toISOString(),
      reason: `${reason}; ${rcNote}${extra?.justification ? `; ${extra.justification}` : ""}`,
      status: "processed",
      processed_at: new Date().toISOString(),
    });
  } catch {
    /* dreptul la ștergere prevalează */
  }

  // 4) Audit log dacă a acționat un admin.
  if (extra?.actorId) {
    try {
      await (supabaseAdmin as any).from("admin_audit_log").insert({
        actor_id: extra.actorId,
        action: "gdpr.purge_user",
        target_table: "auth.users",
        target_id: userId,
        justification: extra.justification ?? null,
        severity: "critical",
        after_data: { reason, rcNote },
      });
    } catch {
      /* ignore */
    }
  }

  // 5) Hard delete — cascade FK pe schema publică.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return { ok: true, rcNote };
}
