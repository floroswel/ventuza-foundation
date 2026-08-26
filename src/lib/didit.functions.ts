/**
 * Server functions pentru fluxul Didit (age verification).
 * `startDiditVerification` — creează sesiune Didit + o leagă de user.
 * `getMyDiditStatus`      — citește statusul curent pentru profil (poll UI).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDiditStatusForUser, syncDiditStatusForUser } from "@/lib/didit-status.server";

export const startDiditVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ returnUrl: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: hasConsent, error: consentError } = await context.supabase.rpc(
      "has_active_consent",
      { _user_id: context.userId, _kind: "age_verification" },
    );
    if (consentError || hasConsent !== true) throw new Error("age_verification_consent_required");
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

    // Audit: pornirea sesiunii de verificare.
    await context.supabase
      .rpc("record_account_flow_event", {
        _kind: "didit",
        _stage: "session_started",
        _detail: { has_url: Boolean(session.url) } as never,
      })
      .then(() => undefined, () => undefined);

    return {
      sessionId: session.session_id,
      url: session.url,
    };
  });


export const getMyDiditStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getDiditStatusForUser(context.supabase, context.userId);
  });

/**
 * Forțează sincronizarea statusului din Didit (folosit când webhook-ul nu a
 * ajuns — ex. în preview / dev fără tunel public). Cere decizia curentă de
 * la Didit pentru ultima sesiune a userului și o aplică prin RPC.
 */
export const syncMyDiditStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return syncDiditStatusForUser(context.supabase, context.userId);
  });
