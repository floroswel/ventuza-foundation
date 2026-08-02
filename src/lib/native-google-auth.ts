// Native Google Sign-In pentru wrapper-ul Android (Capacitor).
//
// De ce: pe Google Play (WebView) fluxul `lovable.auth.signInWithOAuth("google")`
// deschide pagina Google în WebView, iar Google returnează 404 pentru
// WebView-uri (blocare oficială din 2021). Ca soluție nativă folosim
// `@capgo/capacitor-social-login` care apelează Google Sign-In SDK direct →
// primim un `idToken` → îl schimbăm în sesiune Supabase prin
// `supabase.auth.signInWithIdToken`.
//
// Web-ul continuă să folosească fluxul managed `lovable.auth.signInWithOAuth`.

import { supabase } from "@/integrations/supabase/client";

let initialized = false;
let initializationPromise: Promise<void> | null = null;
let activeLogin: Promise<NativeGoogleResult> | null = null;

export async function isNativeAndroid(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let cachedClientId: string | null = null;
let clientIdProbe: Promise<string | null> | null = null;

function webClientIdSync(): string | null {
  // Build-time env (opțional). Sursa primară e secretul server-side
  // GOOGLE_OAUTH_CLIENT_ID, citit prin `getGoogleWebClientId`.
  const id = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ?? "";
  return id.trim() ? id.trim() : cachedClientId;
}

/**
 * Origin de producție folosit ca fallback în build-ul nativ, unde aplicația
 * rulează de pe `capacitor://localhost` și rutele relative nu există.
 */
const PROD_ORIGIN = "https://suzeta.app";

async function fetchClientIdFromNetwork(): Promise<string | null> {
  // 1) Nativ (sau orice context fără server fn relativ): endpoint public absolut.
  if (await isNativePlatform()) {
    try {
      const res = await fetch(`${PROD_ORIGIN}/api/public/google-client-id`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = (await res.json()) as { clientId?: string | null };
        if (json?.clientId) return json.clientId;
      }
    } catch { /* ignore, cădem pe server fn */ }
  }
  // 2) Web: server fn (același origin).
  try {
    const { getGoogleWebClientId } = await import("@/lib/google-config.functions");
    const r = await getGoogleWebClientId();
    return r?.clientId ?? null;
  } catch {
    return null;
  }
}

/** Rezolvă Client ID-ul: env build-time → cache → secret server-side. */
export async function resolveWebClientId(): Promise<string | null> {
  const local = webClientIdSync();
  if (local) return local;
  if (!clientIdProbe) {
    clientIdProbe = fetchClientIdFromNetwork()
      .then((id) => {
        cachedClientId = id;
        return cachedClientId;
      })
      .catch(() => null);
  }
  return clientIdProbe;
}

export function hasNativeGoogleConfig(): boolean {
  return webClientIdSync() !== null;
}

export async function hasNativeGoogleConfigAsync(): Promise<boolean> {
  return (await resolveWebClientId()) !== null;
}

export async function nativeGoogleSupported(): Promise<boolean> {
  if (!(await resolveWebClientId())) return false;
  return isNativeAndroid();
}



async function ensureInit(clientId: string): Promise<void> {
  if (initialized) return;
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      await SocialLogin.initialize({
        google: {
          // Pluginul numește proprietatea webClientId; Android o folosește drept
          // server client ID / audience. Trebuie să fie clientul OAuth Web.
          webClientId: clientId,
          mode: "online",
        },
      });
      initialized = true;
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  await initializationPromise;
}

export type NativeGoogleResult =
  | { ok: true; diagnostic?: NativeGoogleDiagnostic }
  | {
      ok: false;
      code: "unsupported" | "no_id_token" | "cancelled" | "error";
      message?: string;
      diagnostic?: NativeGoogleDiagnostic;
    };

export type NativeGoogleDiagnostic = {
  stage: "configuration" | "sdk_initialize" | "google_login" | "token_exchange" | "complete";
  code?: string;
  message?: string;
  url?: string;
  httpStatus?: number;
};

function diagnosticFromError(error: unknown, stage: NativeGoogleDiagnostic["stage"]): NativeGoogleDiagnostic {
  const record = typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)
    : {};
  const message = error instanceof Error ? error.message : String(error);
  const urlMatch = message.match(/https?:\/\/[^\s"'<>]+/i);
  const statusMatch = message.match(/(?:status|http|error)[\s:=-]*(\d{3})/i) ?? message.match(/\b(4\d{2}|5\d{2})\b/);
  const rawCode = record.code ?? record.errorCode ?? record.status;
  const rawUrl = record.url ?? record.uri ?? record.endpoint;
  const rawStatus = record.status ?? record.statusCode ?? record.httpStatus;
  return {
    stage,
    code: rawCode === undefined ? undefined : String(rawCode),
    message,
    url: typeof rawUrl === "string" ? rawUrl : urlMatch?.[0],
    httpStatus: typeof rawStatus === "number"
      ? rawStatus
      : statusMatch?.[1]
        ? Number(statusMatch[1])
        : undefined,
  };
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  if (activeLogin) return activeLogin;
  activeLogin = runNativeGoogleSignIn();
  try {
    return await activeLogin;
  } finally {
    activeLogin = null;
  }
}

async function runNativeGoogleSignIn(): Promise<NativeGoogleResult> {
  const clientId = await resolveWebClientId();
  if (!clientId) return {
    ok: false,
    code: "unsupported",
    message: "missing GOOGLE_OAUTH_CLIENT_ID",
    diagnostic: { stage: "configuration", code: "missing_client_id" },
  };

  if (!(await isNativePlatform())) return {
    ok: false,
    code: "unsupported",
    diagnostic: { stage: "configuration", code: "not_native" },
  };

  try {
    try {
      await ensureInit(clientId);
    } catch (error) {
      return {
        ok: false,
        code: "error",
        message: error instanceof Error ? error.message : String(error),
        diagnostic: diagnosticFromError(error, "sdk_initialize"),
      };
    }
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    // Android Credential Manager raportează "USER_CANCELLED" și când NU există
    // niciun credential eligibil (bottom sheet nu apare deloc, ~1s). De aceea
    // încercăm în cascadă: mai întâi bottom sheet cu TOATE conturile de pe
    // device, apoi dialogul standard cu select_account.
    type Attempt = {
      label: string;
      options: Record<string, unknown>;
    };
    const attempts: Attempt[] = [
      {
        label: "bottom_all_accounts",
        options: { forceRefreshToken: false, style: "bottom", filterByAuthorizedAccounts: false, autoSelectEnabled: false },
      },
      {
        label: "standard_select_account",
        options: { forceRefreshToken: false, style: "standard", prompt: "select_account" },
      },
    ];

    let result: { result?: { idToken?: string | null } } | null = null;
    let lastDiagnostic: NativeGoogleDiagnostic | undefined;
    for (const attempt of attempts) {
      try {
        result = (await SocialLogin.login({
          provider: "google",
          options: attempt.options,
        })) as { result?: { idToken?: string | null } };
        break;
      } catch (error) {
        const diagnostic = diagnosticFromError(error, "google_login");
        diagnostic.code = `${diagnostic.code ?? "unknown"}@${attempt.label}`;
        lastDiagnostic = diagnostic;
        // Dacă e o anulare/absență de credential, mai încercăm varianta următoare.
        const cancelLike = /cancel|no credential|NoCredential|16:|activity is cancelled/i.test(
          diagnostic.message ?? "",
        );
        if (!cancelLike) {
          return { ok: false, code: "error", message: diagnostic.message, diagnostic };
        }
      }
    }

    if (!result) {
      const diagnostic = lastDiagnostic ?? {
        stage: "google_login" as const,
        code: "cancelled",
        message: "Google Sign-In cancelled",
      };
      return {
        ok: false,
        code: "cancelled",
        message:
          "Google nu a returnat niciun cont. Verifică: (1) ai un cont Google adăugat în Setări → Conturi pe telefon, (2) SHA-1 al build-ului instalat este în clientul OAuth Android (app.suzeta). Detaliu: " +
          (diagnostic.message ?? ""),
        diagnostic,
      };
    }


    const idToken = result?.result?.idToken ?? null;
    if (!idToken) return {
      ok: false,
      code: "no_id_token",
      diagnostic: { stage: "google_login", code: "no_id_token", message: "Google SDK nu a returnat idToken" },
    };

    const { withAuthTimeout } = await import("@/lib/auth-timeout");
    const { error } = await withAuthTimeout(
      "google_token_exchange",
      supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      }),
    );
    if (error) return {
      ok: false,
      code: "error",
      message: error.message,
      diagnostic: diagnosticFromError(error, "token_exchange"),
    };
    return { ok: true, diagnostic: { stage: "complete" } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const diagnostic = diagnosticFromError(e, "token_exchange");
    if (/cancel/i.test(msg)) return { ok: false, code: "cancelled", message: msg, diagnostic };
    return { ok: false, code: "error", message: msg, diagnostic };
  }
}
