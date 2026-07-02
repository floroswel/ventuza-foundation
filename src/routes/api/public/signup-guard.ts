import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Anti-bot signup throttle. Called by /auth right before supabase.auth.signUp.
// Hashes the caller IP server-side (never stored or returned in clear) and
// records the attempt in public.signup_attempts via the SECURITY DEFINER
// RPC `check_signup_throttle`. Returns 429 when the IP or fingerprint
// exceeds the configured caps (5/h or 20/d per IP, 3/h or 10/d per fp).
const BodySchema = z.object({
  fingerprint: z.string().min(8).max(128).optional(),
});

function extractIp(request: Request): string | null {
  const headers = request.headers;
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  ];
  for (const c of candidates) {
    if (c && c.length > 0 && c.length < 64) return c;
  }
  return null;
}

function hashIp(ip: string): string {
  // Salt with project ref so the hash isn't a stable cross-deploy identifier.
  const salt = process.env.SUPABASE_PROJECT_ID ?? "ventuza";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export const Route = createFileRoute("/api/public/signup-guard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          // empty body is fine
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }

        const ip = extractIp(request);
        const ipHash = ip ? hashIp(ip) : null;
        const fingerprint = parsed.data.fingerprint ?? null;

        if (!ipHash && !fingerprint) {
          // Nothing to throttle on; allow but flag.
          return Response.json({ ok: true, throttled: null });
        }

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { error } = await supabase.rpc("check_signup_throttle", {
          _ip_hash: ipHash ?? "",
          _fingerprint: fingerprint ?? "",
        });

        if (error) {
          const msg = error.message ?? "";
          const throttled = msg.includes("signup_throttled_ip")
            ? "signup_throttled_ip"
            : msg.includes("signup_throttled_fingerprint") || msg.includes("signup_throttled")
              ? "signup_throttled_fingerprint"
              : null;
          if (throttled) {
            // Hourly cap window — conservative upper bound until cap resets.
            const retryAfterSec = msg.includes("daily") ? 86400 : 3600;
            return Response.json(
              { ok: false, error: throttled, retryAfterSec },
              {
                status: 429,
                headers: {
                  "Retry-After": String(retryAfterSec),
                  "Cache-Control": "no-store",
                },
              },
            );
          }
          // Fail-open on infra error — don't lock real users out.
          console.error("[signup-guard] rpc error", error);
          return Response.json({ ok: true, throttled: null, degraded: true });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
