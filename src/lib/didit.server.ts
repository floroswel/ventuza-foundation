/**
 * Server helpers pentru integrarea Didit (age estimation).
 * Rulează DOAR pe server. Nu importa din client / .functions.ts fără dynamic import.
 */
import { createHmac, timingSafeEqual } from "crypto";

const DIDIT_API_BASE = "https://verification.didit.me";
const DIDIT_API_VERSION = "v3";

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

  const res = await fetch(`${DIDIT_API_BASE}/${DIDIT_API_VERSION}/session/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: params.vendorData,
      callback: params.callbackUrl,
      callback_method: "both",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Log detaliat DOAR pe server, nu se scurge la client.
    console.error("[didit] create_session failed", res.status, body.slice(0, 500));
    // Mesaj generic pentru client — nu expunem status code, body sau motive de billing.
    throw new Error(
      "Serviciul de verificare este temporar indisponibil. Te rugăm să încerci din nou în câteva minute.",
    );
  }
  const json = (await res.json()) as DiditCreateSessionResponse;
  if (!json?.session_id || !json?.url) {
    throw new Error("didit_create_session_invalid_response");
  }
  return json;
}

type DiditSignatureInput = {
  rawBody: string;
  signatureV2: string | null;
  signatureRaw: string | null;
  signatureSimple: string | null;
  timestamp: string | null;
};

type DiditSignatureResult = {
  ok: boolean;
  trustedBody: boolean;
  reason?: string;
};

function normalizeSignature(signature: string | null) {
  return signature?.replace(/^sha256=/i, "").trim().toLowerCase() ?? "";
}

function sortForDiditSignature(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForDiditSignature);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, sortForDiditSignature(val)]),
    );
  }
  return value;
}

function diditCanonicalJson(value: unknown) {
  // JSON.stringify păstrează Unicode în mod implicit și folosește separatori compacti,
  // ceea ce corespunde variantei recomandate X-Signature-V2 după sortarea cheilor.
  return JSON.stringify(sortForDiditSignature(value));
}

function safeTimingEqualHex(expectedHex: string, providedSignature: string | null) {
  const provided = normalizeSignature(providedSignature);
  if (!provided) return false;
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verifică semnătura HMAC-SHA256 a payload-ului webhook Didit.
 * Preferă `X-Signature-V2`, acceptă `X-Signature`, iar `X-Signature-Simple`
 * este fallback doar pentru envelope — decizia se re-citește din Didit.
 */
export async function verifyDiditSignature(input: DiditSignatureInput): Promise<DiditSignatureResult> {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) throw new Error("DIDIT_WEBHOOK_SECRET missing on server env");

  if (input.timestamp) {
    const ts = Number(input.timestamp);
    if (!Number.isFinite(ts)) return { ok: false, trustedBody: false, reason: "bad_timestamp" };
    if (Math.abs(Date.now() / 1000 - ts) > 300) {
      return { ok: false, trustedBody: false, reason: "stale_timestamp" };
    }
  }

  if (input.signatureV2) {
    try {
      const parsed = JSON.parse(input.rawBody) as unknown;
      const canonical = diditCanonicalJson(parsed);
      const expected = createHmac("sha256", secret).update(canonical).digest("hex");
      if (safeTimingEqualHex(expected, input.signatureV2)) {
        return { ok: true, trustedBody: true };
      }
    } catch {
      // cădem pe semnătura raw de mai jos
    }
  }

  if (input.signatureRaw) {
    const expected = createHmac("sha256", secret).update(input.rawBody).digest("hex");
    if (safeTimingEqualHex(expected, input.signatureRaw)) {
      return { ok: true, trustedBody: true };
    }
  }

  if (input.signatureSimple && input.timestamp) {
    try {
      const parsed = JSON.parse(input.rawBody) as {
        session_id?: string;
        status?: string;
        webhook_type?: string;
      };
      const simple = `${input.timestamp}:${parsed.session_id ?? ""}:${parsed.status ?? ""}:${parsed.webhook_type ?? ""}`;
      const expected = createHmac("sha256", secret).update(simple).digest("hex");
      if (safeTimingEqualHex(expected, input.signatureSimple)) {
        return { ok: true, trustedBody: false };
      }
    } catch {
      return { ok: false, trustedBody: false, reason: "invalid_body" };
    }
  }

  return { ok: false, trustedBody: false, reason: "signature_mismatch" };
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
    case "awaiting_user":
    case "resubmitted":
      return { status: s, result: "pending" };
    default:
      return { status: s || "pending", result: "pending" };
  }
}

/**
 * Interoghează Didit pentru decizia unei sesiuni (folosit la refresh manual
 * când webhook-ul nu a ajuns — util în preview / dev).
 */
export async function diditFetchDecision(sessionId: string): Promise<{
  status: string | null;
  raw: Record<string, unknown>;
} | null> {
  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) throw new Error("DIDIT_API_KEY missing on server env");

  const res = await fetch(`${DIDIT_API_BASE}/${DIDIT_API_VERSION}/session/${sessionId}/decision/`, {
    method: "GET",
    headers: { "x-api-key": apiKey, Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[didit] fetch_decision failed", res.status, body.slice(0, 500));
    throw new Error("didit_fetch_decision_failed");
  }
  const json = (await res.json()) as Record<string, unknown>;
  const status = (json.status as string | undefined) ?? null;
  return { status, raw: json };
}
