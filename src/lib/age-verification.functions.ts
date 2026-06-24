import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Starts a Didit age verification session.
 * - Creates a Didit session and returns the hosted verification URL.
 * - Marks profile age_status='pending' only after Didit returns a valid session.
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
      return { ok: false as const, error: "not_configured", message: "Verificarea de vârstă nu este configurată." };
    }

    let res: Response;
    try {
      res = await fetch("https://verification.didit.me/v3/session/", {
        method: "POST",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          workflow_id: workflowId,
          vendor_data: context.userId,
          callback: data.callbackUrl,
        }),
      });
    } catch (e) {
      console.error("[age-start] network error", e);
      return { ok: false as const, error: "network", message: "Nu am putut contacta serviciul de verificare. Încearcă mai târziu." };
    }

    const raw = await res.text();
    if (!res.ok) {
      console.error("[age-start] Didit error", res.status, raw);
      let detail = "";
      try { detail = (JSON.parse(raw) as { detail?: string }).detail ?? ""; } catch { /* ignore */ }
      if (/credits/i.test(detail)) {
        return { ok: false as const, error: "no_credits", message: "Serviciul de verificare a vârstei este temporar indisponibil. Te rugăm încearcă mai târziu." };
      }
      return { ok: false as const, error: "provider", message: detail || `Verificare indisponibilă (${res.status}).` };
    }

    let json: { url?: string; session_id?: string };
    try { json = JSON.parse(raw); } catch {
      return { ok: false as const, error: "bad_response", message: "Răspuns invalid de la furnizor." };
    }
    if (!json.url) {
      return { ok: false as const, error: "no_url", message: "Răspuns incomplet de la furnizor." };
    }

    const { error: pendingError } = await context.supabase.rpc("start_age_verification");
    if (pendingError) {
      console.error("[age-start] pending status error", pendingError);
      return { ok: false as const, error: "status_update", message: "Nu am putut actualiza statusul verificării. Încearcă din nou." };
    }

    return { ok: true as const, url: json.url, sessionId: json.session_id ?? null };
  });
