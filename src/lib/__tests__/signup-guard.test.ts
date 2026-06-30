/**
 * Integration tests pentru `/api/public/signup-guard`.
 *
 * Acoperă:
 * 1) Mesajul RO returnat de `mapAuthError` pentru cele două coduri de throttle.
 * 2) Validarea body-ului (400 pe fingerprint invalid).
 * 3) Cap-ul pe device fingerprint: 3 cereri trec, a 4-a primește 429 cu
 *    `error=signup_throttled_fingerprint`, `retryAfterSec` numeric și
 *    header `Retry-After`.
 *
 * Cap-ul pe IP (5/h, 20/zi) NU este acoperit live pentru că rulăm prin
 * Cloudflare, care normalizează `x-forwarded-for`. Snapshot-ul SQL din
 * `security-invariants.test.ts` îl validează la nivel de DB.
 */
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { mapAuthError } from "@/lib/auth-errors";

const BASE_URL =
  process.env.SIGNUP_GUARD_BASE_URL ??
  process.env.VITE_PUBLIC_SITE_URL ??
  "https://ventuza-foundation.lovable.app";
const ENDPOINT = `${BASE_URL.replace(/\/$/, "")}/api/public/signup-guard`;
const LIVE = process.env.RUN_LIVE_GUARD_TESTS === "1";

async function callGuard(body: unknown): Promise<{
  status: number;
  json: Record<string, unknown>;
  retryAfter: string | null;
}> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json, retryAfter: res.headers.get("Retry-After") };
}

function freshFingerprint(): string {
  // 64 hex chars, în range-ul acceptat de zod (8–128) și suficient de unic
  // pentru a nu se ciocni cu rulări anterioare.
  return randomBytes(32).toString("hex");
}

describe("mapAuthError — mesaje RO pentru signup throttle", () => {
  it("signup_throttled_ip → mesaj RO + retryAfterSec=3600", () => {
    const mapped = mapAuthError(new Error("signup_throttled_ip"));
    expect(mapped.code).toBe("signup_throttled");
    expect(mapped.message).toMatch(/conexiune/i);
    expect(mapped.message).toMatch(/peste o oră/i);
    expect(mapped.retryAfterSec).toBe(3600);
    expect(mapped.resetCaptcha).toBe(true);
  });

  it("signup_throttled_fingerprint → mesaj RO menționează dispozitivul", () => {
    const mapped = mapAuthError(new Error("signup_throttled_fingerprint"));
    expect(mapped.code).toBe("signup_throttled");
    expect(mapped.message).toMatch(/dispozitiv/i);
    expect(mapped.retryAfterSec).toBe(3600);
    expect(mapped.resetCaptcha).toBe(true);
  });

  it("signup_throttled generic → tot mesaj RO + countdown", () => {
    const mapped = mapAuthError(new Error("signup_throttled"));
    expect(mapped.code).toBe("signup_throttled");
    expect(mapped.message.length).toBeGreaterThan(0);
    expect(mapped.retryAfterSec).toBeGreaterThan(0);
  });
});

describe.skipIf(!LIVE)("/api/public/signup-guard — live", () => {
  it("respinge body invalid cu 400", async () => {
    const r = await callGuard({ fingerprint: "x" }); // < 8 caractere
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_body");
  });

  it("acceptă primele 3 cereri pe același fingerprint, refuză a 4-a cu 429", async () => {
    const fp = freshFingerprint();

    for (let i = 0; i < 3; i++) {
      const r = await callGuard({ fingerprint: fp });
      expect(r.status, `iter ${i}`).toBe(200);
      expect(r.json.ok).toBe(true);
    }

    const fourth = await callGuard({ fingerprint: fp });
    expect(fourth.status).toBe(429);
    expect(fourth.json.ok).toBe(false);
    expect(fourth.json.error).toBe("signup_throttled_fingerprint");
    expect(typeof fourth.json.retryAfterSec).toBe("number");
    expect(fourth.json.retryAfterSec).toBeGreaterThan(0);
    expect(fourth.retryAfter).not.toBeNull();
    expect(Number(fourth.retryAfter)).toBeGreaterThan(0);
  });

  it("răspunsul 429 produce mesaj RO prin mapAuthError", async () => {
    const fp = freshFingerprint();
    for (let i = 0; i < 3; i++) await callGuard({ fingerprint: fp });
    const blocked = await callGuard({ fingerprint: fp });
    expect(blocked.status).toBe(429);

    const mapped = mapAuthError(new Error(String(blocked.json.error)));
    expect(mapped.code).toBe("signup_throttled");
    expect(mapped.message).toMatch(/[a-zA-ZăâîșțĂÂÎȘȚ]/);
    expect(mapped.retryAfterSec).toBeGreaterThan(0);
  });
});
