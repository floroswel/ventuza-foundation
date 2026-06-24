import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Didit age verification webhook.
 * - PUBLIC endpoint (no JWT). Security enforced by HMAC signature.
 * - Never parses JSON before verifying the signature.
 * - Idempotent on session_id.
 * - Always returns 200 after signature passes, so Didit doesn't retry on
 *   malformed/test payloads.
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

        const expectedHex = createHmac("sha256", secret)
          .update(rawBody)
          .digest("hex");
        const provided = signatureHeader
          .trim()
          .toLowerCase()
          .replace(/^sha256=/, "");

        const a = Buffer.from(provided, "utf8");
        const b = Buffer.from(expectedHex, "utf8");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          console.warn("[age-webhook] invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        // Signature OK. From here on, never return 500 — log and ack.
        try {
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            console.warn("[age-webhook] invalid JSON body, skipped");
            return new Response("ok", { status: 200 });
          }

          const session = (payload.session ?? {}) as Record<string, unknown>;
          const decision = (payload.decision ?? {}) as Record<string, unknown>;

          const vendorData =
            (payload.vendor_data as string | undefined) ??
            (session.vendor_data as string | undefined) ??
            "";

          const sessionId =
            (payload.session_id as string | undefined) ??
            (session.session_id as string | undefined) ??
            (payload.id as string | undefined) ??
            "";

          const statusRaw =
            (payload.status as string | undefined) ??
            (decision.status as string | undefined) ??
            "";

          // Age estimation — try common shapes.
          let estimatedAge: number | null = null;
          const ageEst =
            (decision.age_estimation as Record<string, unknown> | undefined) ??
            (payload.age_estimation as Record<string, unknown> | undefined);
          if (ageEst) {
            const v =
              (ageEst.age as number | undefined) ??
              (ageEst.value as number | undefined);
            if (typeof v === "number") estimatedAge = Math.round(v);
          }

          if (!vendorData || !UUID_RE.test(vendorData)) {
            console.log(
              `[age-webhook] test or invalid vendor_data, skipped (got: ${JSON.stringify(vendorData)})`,
            );
            return new Response("ok", { status: 200 });
          }

          if (!sessionId) {
            console.warn("[age-webhook] missing session_id, skipped");
            return new Response("ok", { status: 200 });
          }

          const result: "pass" | "fail" =
            statusRaw.toLowerCase() === "approved" ? "pass" : "fail";

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          // Idempotency on session_id.
          const { data: existing } = await supabaseAdmin
            .from("age_verifications")
            .select("id")
            .eq("didit_session_id", sessionId)
            .maybeSingle();

          if (existing) {
            return new Response("ok", { status: 200 });
          }

          const { error } = await supabaseAdmin.rpc(
            "record_age_verification",
            {
              p_user_id: vendorData,
              p_result: result,
              p_estimated_age: estimatedAge ?? undefined,
              p_didit_session: sessionId,
              p_status_raw: statusRaw,
            },
          );

          if (error) {
            console.error(
              "[age-webhook] record_age_verification error",
              error,
            );
            return new Response("ok", { status: 200 });
          }

          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("[age-webhook] handler error", err);
          return new Response("ok", { status: 200 });
        }
      },
    },
  },
});
