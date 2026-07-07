/**
 * Server-only FCM HTTP v1 sender.
 *
 * Reads the Firebase service account from `FIREBASE_SERVICE_ACCOUNT_JSON`
 * (Lovable Cloud secret). If the secret is missing, sending is a no-op —
 * the caller (dispatch loop) continues to deliver webpush without crashing.
 *
 * Uses the Web Crypto SubtleCrypto API (RS256) so the code runs on
 * Cloudflare Workers without Node-only crypto.
 *
 * Privacy: this file NEVER inspects or logs payload bodies. The caller
 * (`sendPushToUser`) applies the show_preview / discrete_mode / master_push
 * gates and passes an already-sanitized `PushPayload`.
 */

import type { PushPayload, SubscriptionRow } from "./web-push.server";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

let _cachedToken: { token: string; expiresAt: number } | null = null;
let _accountParseFailed = false;
let _account: ServiceAccount | null = null;

function readAccount(): ServiceAccount | null {
  if (_account) return _account;
  if (_accountParseFailed) return null;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      throw new Error("service account is missing required fields");
    }
    _account = parsed;
    return _account;
  } catch (e) {
    _accountParseFailed = true;
    console.error("[fcm-push] FIREBASE_SERVICE_ACCOUNT_JSON parse failed:", (e as Error).message);
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return readAccount() !== null;
}

// ────────────────────────────────────────────────────────────────────────────
// JWT signing (RS256) via WebCrypto — Workers-compatible.
// ────────────────────────────────────────────────────────────────────────────

function b64urlEncode(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function signJwt(account: ServiceAccount): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const claim = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  };
  const signingInput = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(claim))}`;
  const pk = pemToPkcs8(account.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pk.buffer.slice(pk.byteOffset, pk.byteOffset + pk.byteLength) as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

async function getAccessToken(): Promise<string | null> {
  const account = readAccount();
  if (!account) return null;
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now + 60_000) return _cachedToken.token;
  try {
    const jwt = await signJwt(account);
    const res = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }).toString(),
    });
    if (!res.ok) {
      console.error("[fcm-push] token exchange failed:", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    _cachedToken = {
      token: json.access_token,
      expiresAt: now + (json.expires_in ?? 3000) * 1000,
    };
    return _cachedToken.token;
  } catch (e) {
    console.error("[fcm-push] token exchange error:", (e as Error).message);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Send
// ────────────────────────────────────────────────────────────────────────────

/**
 * `channelType` maps to the Android channel created on device:
 *   messages | matches | system (default).
 */
function channelIdFor(payload: PushPayload & { type?: string }): string {
  const t = (payload.type || payload.tag || "").toLowerCase();
  if (t.includes("message") || t.includes("msg")) return "messages";
  if (t.includes("match") || t.includes("tap") || t.includes("woof") || t.includes("like"))
    return "matches";
  return "system";
}

/**
 * Send one FCM push to a stored subscription (kind='fcm').
 * `sub.endpoint` holds the FCM device token.
 *
 * NOTE: the caller must have already applied privacy gates
 * (master_push, show_preview, discrete_mode). This function does NOT
 * inspect the payload body.
 */
export async function sendFcmOne(
  sub: Pick<SubscriptionRow, "id" | "endpoint">,
  payload: PushPayload & { type?: string },
): Promise<{ ok: boolean; gone: boolean }> {
  const account = readAccount();
  if (!account) return { ok: false, gone: false };
  if (!sub.endpoint) return { ok: false, gone: true };

  const token = await getAccessToken();
  if (!token) return { ok: false, gone: false };

  const channel = channelIdFor(payload);
  const message = {
    message: {
      token: sub.endpoint,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        // Everything in `data` is a string.
        url: payload.url ?? "",
        tag: payload.tag ?? "",
        type: payload.type ?? "",
      },
      android: {
        priority: channel === "system" ? "NORMAL" : "HIGH",
        notification: {
          channel_id: channel,
          tag: payload.tag,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(message),
      },
    );
    if (res.ok) return { ok: true, gone: false };
    const status = res.status;
    // 404 (UNREGISTERED) / 400 with INVALID_ARGUMENT on stale token → prune.
    if (status === 404 || status === 410) return { ok: false, gone: true };
    // Fine-grained FCM error may still be a stale token.
    if (status === 400) {
      const body = await res.text().catch(() => "");
      if (/UNREGISTERED|INVALID_ARGUMENT.*token/i.test(body)) return { ok: false, gone: true };
    }
    return { ok: false, gone: false };
  } catch (e) {
    console.error("[fcm-push] send failed:", (e as Error).message);
    return { ok: false, gone: false };
  }
}
