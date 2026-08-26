/**
 * Pornire sesiune Didit pentru clienți care NU rulează pe același origin cu
 * serverul (app-ul Android împachetat local: `capacitor://localhost`).
 *
 * Server functions TanStack sunt same-origin RPC — în build-ul nativ ele
 * rezolvă către `localhost` și întorc 404. Ruta asta oferă același flux, dar
 * apelabilă cu URL absolut și autentificată prin bearer token Supabase.
 *
 * Securitate: fără bearer valid → 401. Nu returnează date sensibile, doar
 * `session_id` + URL-ul de verificare al userului curent.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getBearerSupabaseContext } from "@/lib/bearer-supabase.server";

const ALLOWED_RETURN_HOSTS = new Set([
  "suzeta.app",
  "www.suzeta.app",
  "ventuza-foundation.lovable.app",
  "localhost",
]);

export const Route = createFileRoute("/api/public/didit-start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bearer = await getBearerSupabaseContext(request);
        if (!bearer.ok) return bearer.response;
        const { supabase, user } = bearer.context;

        let body: { returnUrl?: string } = {};
        try {
          body = (await request.json()) as { returnUrl?: string };
        } catch {
          /* body opțional */
        }

        let returnUrl = "https://suzeta.app/verify/status";
        if (body.returnUrl) {
          try {
            const parsed = new URL(body.returnUrl);
            if (ALLOWED_RETURN_HOSTS.has(parsed.hostname)) returnUrl = parsed.toString();
          } catch {
            /* păstrăm default-ul */
          }
        }

        try {
          const { data: hasConsent, error: consentError } = await supabase.rpc(
            "has_active_consent",
            { _user_id: user.id, _kind: "age_verification" },
          );
          if (consentError || hasConsent !== true) {
            return Response.json({ error: "age_verification_consent_required" }, { status: 403 });
          }

          const { diditCreateSession } = await import("@/lib/didit.server");
          const session = await diditCreateSession({
            vendorData: user.id,
            callbackUrl: returnUrl,
          });

          const workflowId = process.env.DIDIT_WORKFLOW_ID ?? session.workflow_id ?? "";
          const { error } = await supabase.rpc("didit_link_session", {
            _session_id: session.session_id,
            _workflow_id: workflowId,
            _session_url: session.url,
          });
          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }

          return Response.json({ sessionId: session.session_id, url: session.url });
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "Serviciul de verificare este temporar indisponibil.";
          console.error("[didit-start] failed", message);
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
