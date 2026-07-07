/**
 * Alias public pentru webhook-ul Didit — expune același handler la
 * `/api/public/age-webhook` pentru integrări configurate cu acest URL în
 * dashboard-ul Didit. Delegă complet către implementarea din
 * `./didit-webhook.ts` — o singură cale de procesare, o singură logică de
 * verificare semnătură.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type DiditStatusPayload,
  diditFetchDecision,
  extractDiditEstimatedAge,
  mapDiditStatus,
  sanitizeDiditStatusRaw,
  verifyDiditSignature,
} from "@/lib/didit.server";

export const Route = createFileRoute("/api/public/age-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        console.log("[age-webhook] hit (alias didit-webhook)", { bodyLen: raw.length });
        const signature = await verifyDiditSignature({
          rawBody: raw,
          signatureV2: request.headers.get("x-signature-v2"),
          signatureRaw:
            request.headers.get("x-signature") ??
            request.headers.get("x-didit-signature"),
          signatureSimple: request.headers.get("x-signature-simple"),
          timestamp: request.headers.get("x-timestamp"),
        });
        if (!signature.ok) {
          console.warn("[age-webhook] signature rejected", { reason: signature.reason });
          return new Response(`invalid signature: ${signature.reason ?? "unknown"}`, {
            status: 401,
          });
        }

        let payload: DiditStatusPayload;
        try {
          payload = JSON.parse(raw) as DiditStatusPayload;
        } catch {
          return new Response("invalid body", { status: 400 });
        }

        const sessionId = payload.session_id;
        if (!sessionId) return new Response("missing session_id", { status: 400 });

        let authoritativePayload = payload;
        if (!signature.trustedBody) {
          const decision = await diditFetchDecision(sessionId);
          if (!decision) return new Response("session not found", { status: 404 });
          authoritativePayload = {
            ...payload,
            ...(decision.raw as DiditStatusPayload),
            session_id: sessionId,
            status: decision.status ?? payload.status,
          };
        }

        const mapped = mapDiditStatus(authoritativePayload.status);
        const estimatedAge = extractDiditEstimatedAge(authoritativePayload);
        const statusRaw = sanitizeDiditStatusRaw(authoritativePayload);

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { error } = await supabase.rpc("didit_apply_result", {
          _session_id: sessionId,
          _status: mapped.status,
          _result: mapped.result,
          _estimated_age: estimatedAge as number,
          _status_raw: statusRaw as never,
        });

        if (error) {
          console.error("[age-webhook] rpc error", error);
          return new Response(`rpc error: ${error.message}`, { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
