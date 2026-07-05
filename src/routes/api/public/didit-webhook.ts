/**
 * Webhook Didit — primește notificări de status pentru sesiunile de verificare.
 *
 * Securitate:
 *   - Verifică semnătura HMAC-SHA256 din header `X-Signature-V2` / `X-Signature` cu
 *     `DIDIT_WEBHOOK_SECRET` înainte de orice acțiune.
 *   - Scrie DOAR prin RPC `didit_apply_result` (SECURITY DEFINER, GRANT service_role).
 *   - Nu returnează date sensibile.
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

export const Route = createFileRoute("/api/public/didit-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        console.log("[didit-webhook] hit", {
          bodyLen: raw.length,
          hasV2: !!request.headers.get("x-signature-v2"),
          hasSig: !!request.headers.get("x-signature"),
          hasSimple: !!request.headers.get("x-signature-simple"),
          hasTs: !!request.headers.get("x-timestamp"),
        });
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
          console.warn("[didit-webhook] signature rejected", { reason: signature.reason });
          return new Response(`invalid signature: ${signature.reason ?? "unknown"}`, { status: 401 });
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
          console.error("[didit-webhook] rpc error", error);
          return new Response(`rpc error: ${error.message}`, { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
