import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
