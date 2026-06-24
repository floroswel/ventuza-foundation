import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Didit age verification webhook.
 * - PUBLIC endpoint (no JWT). Security is enforced by HMAC signature.
 * - Never parses JSON before verifying the signature.
 * - Idempotent on session_id.
 */
export const Route = createFileRoute("/api/public/age-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.DIDIT_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[age-webhook] DIDIT_WEBHOOK_SECRET missing");
          return new Response("Server misconfigured", { status: 500 });
        }

        const signatureHeader =
          request.headers.get("x-signature") ??
          request.headers.get("X-Signature") ??
          "";

        const rawBody = await request.text();

        // Verify HMAC-SHA256(secret, rawBody) === x-signature (hex).
        const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
        const provided = signatureHeader.trim().toLowerCase().replace(/^sha256=/, "");

        const a = Buffer.from(provided, "utf8");
        const b = Buffer.from(expectedHex, "utf8");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          console.warn("[age-webhook] invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        // Signature OK — safe to parse.
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const vendorData =
          (payload.vendor_data as string | undefined) ??
          ((payload.session as Record<string, unknown> | undefined)?.vendor_data as
            | string
            | undefined);

        const sessionId =
          (payload.session_id as string | undefined) ??
          ((payload.session as Record<string, unknown> | undefined)?.session_id as
            | string
            | undefined) ??
          (payload.id as string | undefined);

        const status =
          (payload.status as string | undefined) ??
          ((payload.decision as Record<string, unknown> | undefined)?.status as
            | string
            | undefined) ??
          "";

        // Age estimation: try a few common shapes.
        let estimatedAge: number | null = null;
        const decision = (payload.decision ?? {}) as Record<string, unknown>;
        const ageEst =
          (decision.age_estimation as Record<string, unknown> | undefined) ??
          (payload.age_estimation as Record<string, unknown> | undefined);
        if (ageEst) {
          const v = (ageEst.age as number | undefined) ?? (ageEst.value as number | undefined);
          if (typeof v === "number") estimatedAge = Math.round(v);
        }

        if (!vendorData || !sessionId) {
          console.warn("[age-webhook] missing vendor_data or session_id");
          // Acknowledge to prevent retries on malformed payloads.
          return new Response("ok", { status: 200 });
        }

        const normalized = status.toLowerCase();
        const result: "pass" | "fail" = normalized === "approved" ? "pass" : "fail";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Idempotency: if we already recorded this session_id, skip.
          const { data: existing } = await supabaseAdmin
            .from("age_verifications")
            .select("id")
            .eq("didit_session_id", sessionId)
            .maybeSingle();

          if (existing) {
            return new Response("ok", { status: 200 });
          }

          const { error } = await supabaseAdmin.rpc("record_age_verification", {
            p_user_id: vendorData,
            p_result: result,
            p_estimated_age: estimatedAge ?? undefined,
            p_didit_session: sessionId,
            p_status_raw: status,
          });

          if (error) {
            console.error("[age-webhook] record_age_verification error", error);
            return new Response("DB error", { status: 500 });
          }
        } catch (err) {
          console.error("[age-webhook] handler error", err);
          return new Response("Server error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
