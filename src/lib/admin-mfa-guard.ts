// Server-only guard. Folosit de funcțiile admin distructive (ban, suspend, purge,
// grant/revoke role, break-glass, manual purge). Conform AGENTS.md → "REGULĂ —
// ADMIN MFA OBLIGATORIE": adminul TREBUIE să fi marcat MFA-ul enrolat înainte de
// orice operațiune sensibilă. Statusul vine din `public.admin_mfa_status`.
//
// NU importa din cod care rulează pe client — folosește `await import(...)` în
// handler-ele server-side ca să nu ajungă supabaseAdmin în bundle.

export async function assertAdminMfa(actorUserId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("admin_mfa_status")
    .select("enrolled")
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (error) throw new Error(`MFA check failed: ${error.message}`);
  if (!data?.enrolled) {
    throw new Error(
      "MFA required: activează 2FA în Setări → Securitate (panou admin) înainte de a executa acțiuni distructive.",
    );
  }
}
