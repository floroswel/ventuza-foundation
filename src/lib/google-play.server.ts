/**
 * Validare reală Google Play Billing prin Android Publisher API v3.
 *
 * Cloudflare Workers nu suportă `googleapis` (Node-only), deci semnăm manual
 * un JWT RS256 cu Web Crypto, schimbăm pe access_token la Google OAuth2,
 * apoi interogăm endpoint-ul `purchases.subscriptions.get` /
 * `purchases.products.get`.
 *
 * Secrete necesare (deja documentate pentru utilizator):
 *  - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  → JSON-ul cheii service account
 *  - GOOGLE_PLAY_PACKAGE_NAME          → ex. "app.ventuza.mobile"
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type SubscriptionResult = {
  startTimeMillis?: string;
  expiryTimeMillis?: string;
  paymentState?: number; // 0=pending, 1=received, 2=free trial, 3=pending deferred
  acknowledgementState?: number;
  autoRenewing?: boolean;
  orderId?: string;
  cancelReason?: number;
};

type ProductResult = {
  purchaseState?: number; // 0=purchased, 1=cancelled, 2=pending
  purchaseTimeMillis?: string;
  acknowledgementState?: number;
  orderId?: string;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google OAuth eșuat (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google OAuth: lipsește access_token");
  return json.access_token;
}

/** Returnează detaliile unei achiziții Google Play (subscription sau one-time). */
export async function verifyGooglePlayPurchase(opts: {
  productId: string;
  purchaseToken: string;
  /** "subscription" sau "product". Default: încearcă ambele. */
  kind?: "subscription" | "product";
}): Promise<{
  valid: boolean;
  isSubscription: boolean;
  expiresAt: string | null;
  raw: SubscriptionResult | ProductResult | null;
  reason?: string;
}> {
  const saRaw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!saRaw || !pkg) {
    return {
      valid: false,
      isSubscription: false,
      expiresAt: null,
      raw: null,
      reason: "Secretele Google Play nu sunt configurate.",
    };
  }
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(saRaw) as ServiceAccount;
  } catch {
    return {
      valid: false,
      isSubscription: false,
      expiresAt: null,
      raw: null,
      reason: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON nu este JSON valid.",
    };
  }
  if (!sa.client_email || !sa.private_key) {
    return {
      valid: false,
      isSubscription: false,
      expiresAt: null,
      raw: null,
      reason: "Service account incomplet (lipsește client_email/private_key).",
    };
  }

  const token = await getAccessToken(sa);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases`;

  const trySubscription = async () => {
    const url = `${base}/subscriptions/${encodeURIComponent(opts.productId)}/tokens/${encodeURIComponent(opts.purchaseToken)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, body: (await r.json().catch(() => null)) as SubscriptionResult | null };
  };
  const tryProduct = async () => {
    const url = `${base}/products/${encodeURIComponent(opts.productId)}/tokens/${encodeURIComponent(opts.purchaseToken)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, body: (await r.json().catch(() => null)) as ProductResult | null };
  };

  if (opts.kind === "product") {
    const { status, body } = await tryProduct();
    if (status === 200 && body && body.purchaseState === 0) {
      return { valid: true, isSubscription: false, expiresAt: null, raw: body };
    }
    return { valid: false, isSubscription: false, expiresAt: null, raw: body, reason: `HTTP ${status}` };
  }

  // Default → încearcă subscription, fallback la product
  const sub = await trySubscription();
  if (sub.status === 200 && sub.body) {
    const expiry = sub.body.expiryTimeMillis ? Number(sub.body.expiryTimeMillis) : null;
    const valid =
      (sub.body.paymentState === 1 || sub.body.paymentState === 2) &&
      !!expiry &&
      expiry > Date.now();
    return {
      valid,
      isSubscription: true,
      expiresAt: expiry ? new Date(expiry).toISOString() : null,
      raw: sub.body,
      reason: valid ? undefined : `paymentState=${sub.body.paymentState ?? "?"}`,
    };
  }

  if (opts.kind === "subscription") {
    return {
      valid: false,
      isSubscription: true,
      expiresAt: null,
      raw: sub.body,
      reason: `HTTP ${sub.status}`,
    };
  }

  const prod = await tryProduct();
  if (prod.status === 200 && prod.body && prod.body.purchaseState === 0) {
    return { valid: true, isSubscription: false, expiresAt: null, raw: prod.body };
  }
  return {
    valid: false,
    isSubscription: false,
    expiresAt: null,
    raw: prod.body,
    reason: `subscription HTTP ${sub.status}, product HTTP ${prod.status}`,
  };
}
