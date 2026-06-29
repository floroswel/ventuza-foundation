import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Claim an orphan business application by its ID (code shown after submit).
 * Lets users who submitted anonymously and later signed up with a different
 * email reclaim their request without manual support.
 */
export const claimBusinessApplicationByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ appId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase
      .rpc("claim_business_application_by_code", { _app_id: data.appId });
    if (error) {
      const m = error.message || "";
      if (/already_claimed/.test(m)) throw new Error("Această cerere e deja revendicată de alt cont.");
      if (/not_found/.test(m)) throw new Error("Cod inexistent. Verifică ID-ul cererii.");
      throw new Error(m || "Nu am putut revendica cererea.");
    }
    return res as { ok: boolean; status: string; legal_name: string | null };
  });

/**
 * After a user signs up / logs in, link any orphan business_applications
 * that were submitted with their email to their auth user_id.
 * If any of those linked apps are already 'approved', also grant the
 * 'business' role (the DB trigger only fires on status change).
 */
export const linkOrphanBusinessApps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email?.toLowerCase();
    if (!email) return { linked: 0, granted: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orphans, error: selErr } = await supabaseAdmin
      .from("business_applications")
      .select("id, status")
      .is("user_id", null)
      .ilike("contact_email", email);
    if (selErr) throw selErr;
    if (!orphans || orphans.length === 0) return { linked: 0, granted: false };

    const ids = orphans.map((o) => o.id);
    const { error: updErr } = await supabaseAdmin
      .from("business_applications")
      .update({ user_id: userId })
      .in("id", ids);
    if (updErr) throw updErr;

    const hasApproved = orphans.some((o) => o.status === "approved");
    let granted = false;
    if (hasApproved) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "business" }, { onConflict: "user_id,role" });
      if (!roleErr) granted = true;
    }
    // Silence unused-var lint for supabase if not used
    void supabase;
    return { linked: ids.length, granted };
  });
