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
  diditFetchDecision,
  mapDiditStatus,
  verifyDiditSignature,
} from "@/lib/didit.server";

type DiditWebhookPayload = {
  session_id?: string;
  status?: string;
  workflow_id?: string;
  vendor_data?: string;
  decision?: {
    age_estimation?: {
      age?: number;
      estimated_age?: number;
      min_age?: number;
    };
  };
  age_estimation?: {
    age?: number;
    estimated_age?: number;
    min_age?: number;
  };
  [k: string]: unknown;
};

function extractEstimatedAge(payload: DiditWebhookPayload): number | null {
  const candidates = [
    payload.decision?.age_estimation?.estimated_age,
    payload.decision?.age_estimation?.age,
    payload.decision?.age_estimation?.min_age,
    payload.age_estimation?.estimated_age,
    payload.age_estimation?.age,
    payload.age_estimation?.min_age,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return Math.round(c);
  }
  return null;
}

export const Route = createFileRoute("/api/public/didit-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = await verifyDiditSignature({
          rawBody: raw,
          signatureV2: request.headers.get("x-signature-v2"),
          signatureRaw:
            request.headers.get("x-signature") ??
            request.headers.get("x-didit-signature"),
          signatureSimple: request.headers.get("x-signature-simple"),
          timestamp: request.headers.get("x-timestamp"),
        });
        if (!signature.ok) return new Response("invalid signature", { status: 401 });

        let payload: DiditWebhookPayload;
        try {
          payload = JSON.parse(raw) as DiditWebhookPayload;
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
            ...(decision.raw as DiditWebhookPayload),
            session_id: sessionId,
            status: decision.status ?? payload.status,
          };
        }

        const mapped = mapDiditStatus(authoritativePayload.status);
        const estimatedAge = extractEstimatedAge(authoritativePayload);

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
          _status_raw: authoritativePayload as never,
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
