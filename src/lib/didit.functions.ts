/**
 * Server functions pentru fluxul Didit (age verification).
 * `startDiditVerification` — creează sesiune Didit + o leagă de user.
 * `getMyDiditStatus`      — citește statusul curent pentru profil (poll UI).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  returnUrl: z.string().url(),
});

export const startDiditVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    const { diditCreateSession } = await import("./didit.server");

    const session = await diditCreateSession({
      vendorData: context.userId,
      callbackUrl: data.returnUrl,
    });

    const workflowId = process.env.DIDIT_WORKFLOW_ID ?? null;

    const { error } = await context.supabase.rpc("didit_link_session", {
      _session_id: session.session_id,
      _workflow_id: workflowId ?? session.workflow_id ?? "",
      _session_url: session.url,
    });
    if (error) throw new Error(error.message);

    return {
      sessionId: session.session_id,
      url: session.url,
    };
  });

export const getMyDiditStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profileRes, sessionRes] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("age_status, age_verified_at, age_provider")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("didit_sessions")
        .select("session_id, status, result, estimated_age, session_url, created_at, resolved_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      profile: profileRes.data ?? null,
      lastSession: sessionRes.data ?? null,
    };
  });
