import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Starts a Didit age verification session.
 * - Marks profile age_status='pending' via RPC start_age_verification()
 * - Creates a Didit session and returns the hosted verification URL.
 */
export const startAgeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { callbackUrl: string }) => {
    if (!data || typeof data.callbackUrl !== "string" || !/^https?:\/\//.test(data.callbackUrl)) {
      throw new Error("Invalid callbackUrl");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.DIDIT_API_KEY;
    const workflowId = process.env.DIDIT_WORKFLOW_ID;
    if (!apiKey || !workflowId) {
      throw new Error("Didit not configured");
    }

    // Mark pending (best-effort).
    await context.supabase.rpc("start_age_verification");

    const res = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: context.userId,
        callback: data.callbackUrl,
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error("[age-start] Didit error", res.status, raw);
      let detail = "";
      try { detail = (JSON.parse(raw) as { detail?: string }).detail ?? ""; } catch { /* ignore */ }
      if (/credits/i.test(detail)) {
        throw new Error("Serviciul de verificare a vârstei este temporar indisponibil (credite epuizate la furnizor). Te rugăm încearcă mai târziu.");
      }
      throw new Error(detail || `Didit session creation failed (${res.status})`);
    }

    let json: { url?: string; session_id?: string };
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error("Didit returned invalid JSON");
    }

    if (!json.url) {
      throw new Error("Didit response missing session url");
    }

    return { url: json.url, sessionId: json.session_id ?? null };
  });
