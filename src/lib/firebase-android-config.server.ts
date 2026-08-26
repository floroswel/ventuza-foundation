type FirebaseServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

function base64Url(value: Uint8Array | string): string {
  const binary = typeof value === "string" ? value : String.fromCharCode(...value);
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function privateKeyBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function accessToken(account: FirebaseServiceAccount): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const tokenUrl = account.token_uri || "https://oauth2.googleapis.com/token";
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: tokenUrl,
      iat: issuedAt,
      exp: issuedAt + 3_600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const bytes = privateKeyBytes(account.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Firebase authentication failed [${response.status}]`);
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Firebase authentication returned no access token");
  return body.access_token;
}

export async function downloadFirebaseAndroidConfig(): Promise<string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  const account = JSON.parse(raw) as FirebaseServiceAccount;
  if (!account.client_email || !account.private_key || !account.project_id) {
    throw new Error("Firebase service account is incomplete");
  }
  const token = await accessToken(account);
  const headers = { authorization: `Bearer ${token}` };
  const appsResponse = await fetch(
    `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(account.project_id)}/androidApps`,
    { headers },
  );
  if (!appsResponse.ok) {
    throw new Error(`Firebase Android app lookup failed [${appsResponse.status}]`);
  }
  const apps = (await appsResponse.json()) as {
    apps?: Array<{ name?: string; packageName?: string }>;
  };
  let app = apps.apps?.find((candidate) => candidate.packageName === "app.suzeta");
  if (!app?.name) {
    // Recuperare idempotentă pentru proiectele vechi care aveau cheia de
    // service account pentru FCM, dar nu înregistraseră încă aplicația Android.
    // Valorile sunt fixe; endpoint-ul nu acceptă input și nu poate provisiona
    // alte package-uri sau resurse arbitrare.
    const createResponse = await fetch(
      `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(account.project_id)}/androidApps`,
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "app.suzeta", displayName: "Suzeta Android" }),
      },
    );
    if (!createResponse.ok) {
      throw new Error(`Firebase Android app creation failed [${createResponse.status}]`);
    }
    const operation = (await createResponse.json()) as { name?: string };
    if (!operation.name) throw new Error("Firebase Android app creation returned no operation");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const operationResponse = await fetch(
        `https://firebase.googleapis.com/v1beta1/${operation.name}`,
        { headers },
      );
      if (!operationResponse.ok) {
        throw new Error(`Firebase operation lookup failed [${operationResponse.status}]`);
      }
      const state = (await operationResponse.json()) as {
        done?: boolean;
        error?: { message?: string };
        response?: { name?: string; packageName?: string };
      };
      if (state.error) throw new Error(state.error.message || "Firebase app creation failed");
      if (state.done && state.response?.name) {
        app = state.response;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!app?.name) throw new Error("Firebase Android app app.suzeta is not ready");
  const configResponse = await fetch(
    `https://firebase.googleapis.com/v1beta1/${app.name}/config`,
    { headers },
  );
  if (!configResponse.ok) {
    throw new Error(`Firebase Android config download failed [${configResponse.status}]`);
  }
  const config = (await configResponse.json()) as { configFileContents?: string };
  if (!config.configFileContents) throw new Error("Firebase returned an empty Android config");
  return atob(config.configFileContents);
}