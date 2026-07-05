/**
 * Server helpers pentru integrarea Didit (age estimation).
 * Rulează DOAR pe server. Nu importa din client / .functions.ts fără dynamic import.
 */

const DIDIT_API_BASE = "https://verification.didit.me";

export type DiditCreateSessionResponse = {
  session_id: string;
  session_number?: number | string;
  session_token?: string;
  url: string;
  status?: string;
  vendor_data?: string;
  workflow_id?: string;
  created_at?: string;
};

export async function diditCreateSession(params: {
  vendorData: string;
  callbackUrl: string;
}): Promise<DiditCreateSessionResponse> {
  const apiKey = process.env.DIDIT_API_KEY;
  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  if (!apiKey) throw new Error("DIDIT_API_KEY missing on server env");
  if (!workflowId) throw new Error("DIDIT_WORKFLOW_ID missing on server env");

  const res = await fetch(`${DIDIT_API_BASE}/v2/session/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: params.vendorData,
      callback: params.callbackUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`didit_create_session_failed ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as DiditCreateSessionResponse;
  if (!json?.session_id || !json?.url) {
    throw new Error("didit_create_session_invalid_response");
  }
  return json;
}

/**
 * Verifică semnătura HMAC-SHA256 a payload-ului webhook Didit.
 * Semnătura sosește pe headerul `X-Signature` (hex, fără prefix).
 */
export async function verifyDiditSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) throw new Error("DIDIT_WEBHOOK_SECRET missing on server env");
  if (!signatureHeader) return false;

  const { createHmac, timingSafeEqual } = await import("crypto");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Mapează statusurile Didit la rezultatul intern (`pass` / `fail` / `pending`).
 * Vezi https://docs.didit.me/reference/statuses
 */
export function mapDiditStatus(status: string | null | undefined): {
  status: string;
  result: "pass" | "fail" | "pending";
} {
  const s = String(status ?? "").toLowerCase().replace(/\s+/g, "_");
  switch (s) {
    case "approved":
      return { status: "approved", result: "pass" };
    case "declined":
      return { status: "declined", result: "fail" };
    case "kyc_expired":
    case "expired":
      return { status: "expired", result: "fail" };
    case "abandoned":
      return { status: "abandoned", result: "fail" };
    case "in_review":
      return { status: "in_review", result: "pending" };
    case "in_progress":
      return { status: "in_progress", result: "pending" };
    case "not_started":
      return { status: "created", result: "pending" };
    default:
      return { status: s || "pending", result: "pending" };
  }
}
