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
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

        const url = process.env.SUPABASE_URL!;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(url, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userRes?.user) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

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
            { _user_id: userRes.user.id, _kind: "age_verification" },
          );
          if (consentError || hasConsent !== true) {
            return Response.json({ error: "age_verification_consent_required" }, { status: 403 });
          }

          const { diditCreateSession } = await import("@/lib/didit.server");
          const session = await diditCreateSession({
            vendorData: userRes.user.id,
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
