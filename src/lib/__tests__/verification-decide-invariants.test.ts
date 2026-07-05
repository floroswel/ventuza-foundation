/**
 * Integration tests — `verification_moderator_decide` respinge intrări
 * invalide și emite RAISE WARNING cu actor + request_id pentru fiecare
 * eșec de validare.
 *
 * Strategia (aliniată cu security-invariants.test.ts):
 *  1) Snapshot introspecție SQL (`verification_decide_invariants_snapshot`) —
 *     confirmă că sursa funcției conține toate validările + warning-urile
 *     cu `actor` și `request` în format. Astfel prindem regresiile chiar
 *     dacă anon nu poate rula funcția real.
 *  2) Comportament live anonim — funcția este gated pe `is_verification_staff`
 *     și trebuie să refuze apelantul anonim.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

function client() {
  if (!url || !key) {
    throw new Error("Lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("verification_moderator_decide — introspecție validări + logging", () => {
  it("snapshot-ul confirmă toate validările și warning-urile cu actor + request_id", async () => {
    const supabase = client();
    const { data, error } = await supabase.rpc(
      "verification_decide_invariants_snapshot",
    );
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const s = data as Record<string, boolean>;

    // funcția există
    expect(s.present).toBe(true);

    // validări obligatorii
    expect(s.validates_decision).toBe(true);
    expect(s.validates_reason_code_req).toBe(true);
    expect(s.validates_reason_code_enum).toBe(true);
    expect(s.validates_confidence).toBe(true);
    expect(s.validates_reason_length).toBe(true);
    expect(s.validates_not_found).toBe(true);
    expect(s.validates_not_your_claim).toBe(true);
    expect(s.validates_forbidden).toBe(true);
    expect(s.validates_second_binary).toBe(true);

    // logging cu actor + request pentru fiecare eșec
    expect(s.warns_reason_code).toBe(true);
    expect(s.warns_confidence).toBe(true);
    expect(s.warns_reason_req).toBe(true);
    expect(s.warns_reason_code_req).toBe(true);
    expect(s.warns_invalid_decision).toBe(true);
    expect(s.warns_not_your_claim).toBe(true);
    expect(s.warns_not_found).toBe(true);
    expect(s.warns_forbidden).toBe(true);
    expect(s.warns_second_binary).toBe(true);

    // enum-uri complete (nu se pot restrânge silențios)
    expect(s.allowed_reason_codes_complete).toBe(true);
    expect(s.allowed_confidence_complete).toBe(true);
  });
});

describe("verification_moderator_decide — comportament live anonim", () => {
  it("refuză apelantul anonim (forbidden — gate `is_verification_staff` activ)", async () => {
    const supabase = client();
    const { error } = await supabase.rpc("verification_moderator_decide", {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_decision: "approve",
      p_reason_code: "other",
      p_reason: "test anonim — trebuie respins înainte de orice validare de business",
      p_confidence: "medium",
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(
      /forbidden|permission|denied|not_authenticated|JWT|42501/i,
    );
  });

  it("respinge un reason_code invalid ca apelant anonim (gate-ul precedă validarea, dar RPC-ul nu returnează niciodată OK)", async () => {
    const supabase = client();
    const { data, error } = await supabase.rpc("verification_moderator_decide", {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_decision: "reject",
      p_reason_code: "nu_exista_acest_cod",
      p_reason: "payload invalid — nu trebuie să treacă",
      p_confidence: "high",
    });
    expect(error).not.toBeNull();
    expect(data ?? null).toBeNull();
  });

  // Gate-ul `is_verification_staff` trebuie să respingă apelantul anonim
  // ÎNAINTE de orice validare de business, indiferent cât de „stricat" e
  // payload-ul. Adică mesajul de eroare și codul trebuie să fie identice
  // (forbidden / 42501) pentru toate variantele de mai jos — altfel un
  // atacator neautentificat poate distinge între payload-uri valide și
  // invalide prin oracle timing / mesaj.
  const anonVariants: Array<{ name: string; payload: Record<string, unknown> }> = [
    {
      name: "decision invalid",
      payload: {
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_decision: "nu_exista",
        p_reason_code: "other",
        p_reason: "x".repeat(20),
        p_confidence: "medium",
      },
    },
    {
      name: "confidence invalid",
      payload: {
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_decision: "approve",
        p_reason_code: "other",
        p_reason: "x".repeat(20),
        p_confidence: "cosmic",
      },
    },
    {
      name: "reason gol la reject",
      payload: {
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_decision: "reject",
        p_reason_code: "other",
        p_reason: "",
        p_confidence: "high",
      },
    },
    {
      name: "reason_code lipsă la reject",
      payload: {
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_decision: "reject",
        p_reason_code: null,
        p_reason: "motiv suficient de lung pentru validare",
        p_confidence: "high",
      },
    },
    {
      name: "request_id inexistent + payload valid",
      payload: {
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_decision: "approve",
        p_reason_code: "other",
        p_reason: "motiv suficient de lung pentru validare",
        p_confidence: "medium",
      },
    },
    {
      name: "needs_second cu confidence high (second_review_binary)",
      payload: {
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_decision: "needs_second",
        p_reason_code: "other",
        p_reason: "motiv suficient de lung pentru validare",
        p_confidence: "high",
      },
    },
  ];

  for (const variant of anonVariants) {
    it(`refuză consistent apelantul anonim — variant: ${variant.name}`, async () => {
      const supabase = client();
      const { data, error } = await supabase.rpc(
        "verification_moderator_decide",
        variant.payload as never,
      );
      expect(error).not.toBeNull();
      expect(data ?? null).toBeNull();
      // Toate variantele trebuie să lovească același gate (forbidden /
      // 42501), nu o eroare de validare — asta confirmă că `is_verification_staff`
      // rulează înainte de orice logică de business.
      expect(error?.message ?? "").toMatch(
        /forbidden|permission|denied|not_authenticated|JWT|42501/i,
      );
      // Nu trebuie să scape mesaje care descriu validările interne
      // (ex: `invalid_reason_code`, `invalid_confidence`, `not_found`)
      // către un apelant anonim — ar fi un oracle.
      expect(error?.message ?? "").not.toMatch(
        /invalid_reason_code|invalid_confidence|reason_required|reason_code_required|invalid_decision|not_found|second_review_binary/i,
      );
    });
  }
});

