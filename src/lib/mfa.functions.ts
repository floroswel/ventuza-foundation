import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Factorii MFA ai utilizatorului curent (doar metadate, niciun secret).
 * Folosit în Setări pentru a arăta transparent dacă există un autentificator
 * activ pe cont — sursa reală de adevăr, nu presupunerile UI-ului.
 */
export const listMyMfaFactors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: context.userId,
    });
    if (error) throw new Error(error.message);
    const factors = (data?.factors ?? []).map((f) => ({
      id: f.id,
      type: f.factor_type,
      status: f.status,
      friendlyName: f.friendly_name ?? null,
      createdAt: f.created_at,
    }));
    return { factors, hasVerified: factors.some((f) => f.status === "verified") };
  });

/**
 * Dezactivează 2FA pe contul propriu după verificarea parolei curente.
 * Parola curentă e dovada de posesie; nu cerem codul autentificatorului
 * tocmai pentru cazul în care userul nu mai are acces la el (sau nu a
 * activat niciodată conștient MFA).
 */
export const disableMyMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { currentPassword: string }) => {
    if (!d?.currentPassword || d.currentPassword.length < 6) {
      throw new Error("current_password_required");
    }
    return { currentPassword: d.currentPassword };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userErr || !userRes?.user?.email) throw new Error("account_not_found");

    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
    const checker = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await checker.auth.signInWithPassword({
      email: userRes.user.email,
      password: data.currentPassword,
    });
    if (signInErr) throw new Error("invalid_current_password");

    const { data: list } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: context.userId,
    });
    let removed = 0;
    for (const factor of list?.factors ?? []) {
      const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: context.userId,
      });
      if (error) throw new Error(error.message);
      removed += 1;
    }
    return { ok: true, removed };
  });
