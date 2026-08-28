// Cache central pentru URL-uri semnate din Supabase Storage.
//
// Motivul: fiecare card din Discover / bulă de chat cerea propriul URL semnat,
// deci zeci de request-uri POST /object/sign duplicate la fiecare montare de
// componentă. Aici:
//   1. deduplicăm request-urile în zbor (aceeași cale = o singură promisiune),
//   2. batch-uim cererile printr-un singur `createSignedUrls`,
//   3. păstrăm rezultatul în memorie + sessionStorage până aproape de expirare.
//
// Niciun URL nu este păstrat după expirare; TTL-ul efectiv are o marjă de
// siguranță de 60s.

import { supabase } from "@/integrations/supabase/client";
import { performanceSettings } from "@/lib/runtime-settings";

type Entry = { url: string; expiresAt: number };

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
const SAFETY_MS = 60_000;
/**
 * TTL lung intenționat (8h): URL-urile semnate sunt cache-uite persistent în
 * localStorage și în Cache Storage (service worker), deci pozele de profil nu
 * se mai re-descarcă la fiecare sesiune. Marja de siguranță rămâne 60s.
 */
export const DEFAULT_TTL_SEC = 8 * 3600;

/** TTL efectiv, administrabil din /admin (`performance_settings`). */
export function ttlSeconds(): number {
  const h = performanceSettings().signed_url_ttl_hours;
  return Math.round(Math.max(1, Math.min(24, h)) * 3600);
}
const STORE_KEY = "suzeta:signed-urls:v2";

function isRemote(path: string) {
  return /^https?:\/\//i.test(path);
}

function keyOf(bucket: string, path: string) {
  return `${bucket}/${path}`;
}

let hydrated = false;
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.url === "string" && v.expiresAt > now) memory.set(k, v);
    }
  } catch {
    /* noop */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (typeof window === "undefined") return;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const now = Date.now();
      const obj: Record<string, Entry> = {};
      for (const [k, v] of memory) if (v.expiresAt > now) obj[k] = v;
      window.localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    } catch {
      /* noop */
    }
  }, 500);
}

function getFresh(bucket: string, path: string): string | null {
  hydrate();
  const hit = memory.get(keyOf(bucket, path));
  if (hit && hit.expiresAt > Date.now()) return hit.url;
  return null;
}

function store(bucket: string, path: string, url: string, ttlSec: number) {
  memory.set(keyOf(bucket, path), {
    url,
    expiresAt: Date.now() + ttlSec * 1000 - SAFETY_MS,
  });
  persistSoon();
}

/** URL semnat pentru o singură cale, cu cache + dedupe. */
export async function getSignedUrl(
  bucket: string,
  path: string | null | undefined,
  ttlSec = ttlSeconds(),
): Promise<string | null> {
  if (!path) return null;
  if (isRemote(path)) return path;

  const cached = getFresh(bucket, path);
  if (cached) return cached;

  const k = keyOf(bucket, path);
  const pending = inflight.get(k);
  if (pending) return pending;

  const p = (async () => {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSec);
      if (error || !data?.signedUrl) return null;
      store(bucket, path, data.signedUrl, ttlSec);
      return data.signedUrl;
    } catch {
      return null;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}

/** URL-uri semnate pentru mai multe căi, într-un singur request de rețea. */
export async function getSignedUrls(
  bucket: string,
  paths: string[],
  ttlSec = ttlSeconds(),
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing: string[] = [];

  for (const p of Array.from(new Set(paths.filter(Boolean)))) {
    if (isRemote(p)) {
      out[p] = p;
      continue;
    }
    const cached = getFresh(bucket, p);
    if (cached) out[p] = cached;
    else missing.push(p);
  }

  if (!missing.length) return out;

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, ttlSec);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const path = (row as { path?: string | null }).path;
        const url = (row as { signedUrl?: string | null }).signedUrl;
        if (path && url) {
          out[path] = url;
          store(bucket, path, url, ttlSec);
        }
      }
    }
  } catch {
    /* fallback mai jos */
  }

  // Fallback individual pentru orice cale rămasă nerezolvată.
  const stillMissing = missing.filter((p) => !out[p]);
  if (stillMissing.length) {
    await Promise.all(
      stillMissing.map(async (p) => {
        const u = await getSignedUrl(bucket, p, ttlSec);
        if (u) out[p] = u;
      }),
    );
  }

  return out;
}

/** Citire sincronă din cache (fără rețea) — folosită pentru randare instantă. */
export function peekSignedUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (isRemote(path)) return path;
  return getFresh(bucket, path);
}

/** Invalidează o intrare (URL semnat expirat / imagine care nu se încarcă). */
export function invalidateSignedUrl(bucket: string, path: string) {
  const k = keyOf(bucket, path);
  memory.delete(k);
  inflight.delete(k);
  persistSoon();
}

