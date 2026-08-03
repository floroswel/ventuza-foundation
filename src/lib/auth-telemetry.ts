// Telemetrie de autentificare pentru build-ul Android (fără date sensibile).
//
// Reguli de redactare: NU se loghează parole, access/refresh token, captcha
// token, anon key complet sau emailul integral (doar formă mascată).

export type AuthStage = {
  name: string;
  ms: number;
  detail?: string;
};

const stages: AuthStage[] = [];

export function resetAuthStages() {
  stages.length = 0;
}

export function recordStage(name: string, ms: number, detail?: string) {
  stages.push({ name, ms: Math.round(ms), detail });
  if (stages.length > 60) stages.shift();
}

export function readAuthStages(): AuthStage[] {
  return [...stages];
}

/** Cronometrează o etapă și o înregistrează, indiferent de rezultat. */
export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await fn();
    recordStage(name, Date.now() - t0, "ok");
    return out;
  } catch (error) {
    recordStage(name, Date.now() - t0, error instanceof Error ? error.name : "error");
    throw error;
  }
}

/** Mască email pentru loguri: a***@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

export type SupabaseHealth = {
  host: string;
  status: "connected" | "timeout" | "network_error" | "http_error";
  httpStatus?: number;
  durationMs: number;
};

function supabaseUrl(): string {
  return (
    (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
    "https://szzxhvvmwqvfyoldcuyz.supabase.co"
  );
}

/** Confirmă că runtime-ul Android chiar poate ajunge la Supabase (HTTPS). */
export async function supabaseHealthCheck(timeoutMs = 6000): Promise<SupabaseHealth> {
  const base = supabaseUrl().replace(/\/+$/, "");
  const host = (() => {
    try {
      return new URL(base).host;
    } catch {
      return base;
    }
  })();
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/auth/v1/health`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ?? "" },
    });
    return {
      host,
      status: res.ok ? "connected" : "http_error",
      httpStatus: res.status,
      durationMs: Date.now() - t0,
    };
  } catch (error) {
    const timedOut = error instanceof Error && /abort|timeout/i.test(error.name + error.message);
    return {
      host,
      status: timedOut ? "timeout" : "network_error",
      durationMs: Date.now() - t0,
    };
  }
}

/** Verifică dacă transportul este HTTPS și dacă URL-ul nu e legacy/localhost. */
export function inspectSupabaseConfig(): {
  url: string;
  https: boolean;
  legacyHost: boolean;
  keyPresent: boolean;
} {
  const url = supabaseUrl();
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";
  return {
    url,
    https: url.startsWith("https://"),
    legacyHost: /localhost|ventuza/i.test(url),
    keyPresent: key.trim().length > 20,
  };
}
