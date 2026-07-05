/**
 * Teste end-to-end pentru aprobarea/respingerea manuală în dashboard-ul Didit.
 *
 * Simulăm:
 *   1. Utilizatorul are o sesiune Didit deschisă → `age_status='pending'`.
 *   2. Operator uman merge în Didit și marchează `approved` / `declined` /
 *      `kyc_expired`.
 *   3. Aplicația trebuie să prindă decizia:
 *      - fie prin webhook (`/api/public/didit-webhook`),
 *      - fie prin sync manual (`syncMyDiditStatus` → `didit_apply_result`).
 *
 * Ambele căi ajung la același RPC `didit_apply_result`. Testele de aici
 * validează layerul care traduce răspunsul Didit în formatul așteptat de RPC
 * și că fetch-ul manual către `/v2/session/{id}/decision/` folosește
 * headerele corecte.
 *
 * Nu lovim DB real — testul se concentrează pe logica pură (mapare status,
 * extragere vârstă estimată, apel HTTP către Didit). Aplicarea în DB este
 * acoperită de RPC-ul `didit_apply_result` care are propriile invariante SQL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  diditFetchDecision,
  extractDiditEstimatedAge,
  mapDiditStatus,
} from "@/lib/didit.server";

type DiditPayload = {
  session_id: string;
  status: string;
  decision?: {
    age_estimation?: { estimated_age?: number; age?: number; min_age?: number };
  };
  age_estimation?: { estimated_age?: number; age?: number; min_age?: number };
  liveness_checks?: Array<{
    age_estimation?: number | { estimated_age?: number; age?: number; min_age?: number };
  }>;
};

describe("Didit manual approval flow — status mapping", () => {
  it("`approved` din Didit → RPC primește pass și profilul devine verified", () => {
    const mapped = mapDiditStatus("Approved");
    expect(mapped).toEqual({ status: "approved", result: "pass" });
  });

  it("`declined` din Didit → RPC primește fail, profilul devine failed", () => {
    expect(mapDiditStatus("Declined")).toEqual({
      status: "declined",
      result: "fail",
    });
  });

  it("`kyc_expired` / `expired` → RPC primește fail cu status=expired", () => {
    expect(mapDiditStatus("kyc_expired")).toEqual({
      status: "expired",
      result: "fail",
    });
    expect(mapDiditStatus("expired")).toEqual({
      status: "expired",
      result: "fail",
    });
  });

  it("`in_review` / `in_progress` → rămâne pending", () => {
    expect(mapDiditStatus("in_review").result).toBe("pending");
    expect(mapDiditStatus("in_progress").result).toBe("pending");
  });

  it("status necunoscut → pending (nu blocăm userul pe verdict neinterpretabil)", () => {
    expect(mapDiditStatus("something_new_from_didit").result).toBe("pending");
    expect(mapDiditStatus(null).result).toBe("pending");
    expect(mapDiditStatus(undefined).result).toBe("pending");
  });
});

describe("Didit manual approval flow — extragere vârstă estimată", () => {
  it("preferă decision.age_estimation.estimated_age", () => {
    const age = extractDiditEstimatedAge({
      session_id: "s1",
      status: "approved",
      decision: { age_estimation: { estimated_age: 27.4, min_age: 18 } },
    });
    expect(age).toBe(27);
  });

  it("cade pe age_estimation top-level dacă decision lipsește", () => {
    const age = extractDiditEstimatedAge({
      session_id: "s1",
      status: "approved",
      age_estimation: { age: 22 },
    });
    expect(age).toBe(22);
  });

  it("întoarce null când nu are estimare (ex. verificare manuală fără liveness)", () => {
    const age = extractDiditEstimatedAge({ session_id: "s1", status: "approved" });
    expect(age).toBeNull();
  });

  it("citește structura V3 liveness_checks[].age_estimation numeric", () => {
    const age = extractDiditEstimatedAge({
      session_id: "s1",
      status: "Approved",
      liveness_checks: [{ age_estimation: 32.62 }],
    });
    expect(age).toBe(33);
  });
});

describe("diditFetchDecision — sync manual când webhook-ul nu ajunge", () => {
  const ORIGINAL_ENV = process.env.DIDIT_API_KEY;

  beforeEach(() => {
    process.env.DIDIT_API_KEY = "test_api_key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.DIDIT_API_KEY = ORIGINAL_ENV;
  });

  it("apelează endpoint-ul corect cu X-Api-Key și întoarce decizia", async () => {
    const payload = {
      session_id: "sess_123",
      status: "Approved",
      decision: { age_estimation: { estimated_age: 31 } },
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const decision = await diditFetchDecision("sess_123");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://verification.didit.me/v3/session/sess_123/decision/",
    );
    expect((init as RequestInit).method).toBe("GET");
    expect(
      (init as RequestInit).headers as Record<string, string>,
    ).toMatchObject({ "x-api-key": "test_api_key" });

    expect(decision).not.toBeNull();
    expect(decision!.status).toBe("Approved");
    expect(mapDiditStatus(decision!.status)).toEqual({
      status: "approved",
      result: "pass",
    });
  });

  it("întoarce null la 404 (sesiune expirată / ștearsă în Didit)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    const decision = await diditFetchDecision("gone");
    expect(decision).toBeNull();
  });

  it("aruncă eroare generică la 5xx (nu scurgem detalii Didit la client)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("internal", { status: 500 }),
    );
    await expect(diditFetchDecision("boom")).rejects.toThrow(
      /didit_fetch_decision_failed/,
    );
  });

  it("aruncă dacă lipsește DIDIT_API_KEY (fail-fast în server env)", async () => {
    delete process.env.DIDIT_API_KEY;
    await expect(diditFetchDecision("x")).rejects.toThrow(/DIDIT_API_KEY/);
  });
});

describe("Scenariu complet — aprobare manuală în dashboard Didit", () => {
  it("mapare completă approved: decizia Didit → argumente RPC didit_apply_result", async () => {
    process.env.DIDIT_API_KEY = "k";
    const raw = {
      session_id: "sess_manual_1",
      status: "Approved",
      decision: { age_estimation: { estimated_age: 34 } },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(raw), { status: 200 }),
    );

    const decision = await diditFetchDecision("sess_manual_1");
    const mapped = mapDiditStatus(decision!.status);
    const estimatedAge = extractDiditEstimatedAge(raw);

    // Aceste 4 câmpuri sunt exact ce trimite syncMyDiditStatus la RPC.
    // RPC-ul aplică `age_status='verified'` când result='pass' + age >=18.
    expect({
      _session_id: "sess_manual_1",
      _status: mapped.status,
      _result: mapped.result,
      _estimated_age: estimatedAge,
    }).toEqual({
      _session_id: "sess_manual_1",
      _status: "approved",
      _result: "pass",
      _estimated_age: 34,
    });

    vi.restoreAllMocks();
  });

  it("mapare completă declined: profilul trebuie să ajungă la failed", async () => {
    process.env.DIDIT_API_KEY = "k";
    const raw = { session_id: "sess_manual_2", status: "Declined" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(raw), { status: 200 }),
    );

    const decision = await diditFetchDecision("sess_manual_2");
    const mapped = mapDiditStatus(decision!.status);

    expect(mapped).toEqual({ status: "declined", result: "fail" });
    vi.restoreAllMocks();
  });
});
