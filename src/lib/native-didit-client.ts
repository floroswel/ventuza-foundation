import { supabase } from "@/integrations/supabase/client";
import type { DiditStatusResponse, DiditSyncResponse } from "@/lib/didit-types";

const API_ORIGIN = "https://suzeta.app";

async function bearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesiunea a expirat. Autentifică-te din nou pentru a continua.");
  return token;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await bearerToken();
  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(json.error || "Cererea nu a putut fi procesată.");
  return json;
}

export function startNativeDiditVerification(returnUrl: string) {
  return apiJson<{ sessionId: string; url: string }>("/api/public/didit-start", {
    method: "POST",
    body: JSON.stringify({ returnUrl }),
  });
}

export function getNativeDiditStatus() {
  return apiJson<DiditStatusResponse>("/api/public/didit-status", { method: "GET" });
}

export function syncNativeDiditStatus() {
  return apiJson<DiditSyncResponse>("/api/public/didit-sync", { method: "POST" });
}
