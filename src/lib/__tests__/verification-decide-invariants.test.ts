/**
 * Verification-moderator legacy — DEPRECATED.
 *
 * Fluxul intern (liveness + moderator) este DEZACTIVAT prin regulă de proiect
 * ("REGULĂ — AGE GATE"): verificarea de vârstă se face EXCLUSIV prin Didit.
 * RPC-ul `verification_moderator_decide` rămâne ca schelet dormant, dar
 * refuză toate apelurile cu `verification_moderator_disabled: age verification
 * is Didit-only`, indiferent de rol.
 *
 * Testul de mai jos validează exact această invariantă: nu există cale prin
 * care RPC-ul să returneze OK pentru vreun apelant (anon, staff, super_admin),
 * pentru niciun payload. Snapshot-ul de introspecție al vechilor validări
 * este skipped până când / dacă fluxul intern se reactivează.
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

const REJECTED = /forbidden|permission|denied|not_authenticated|JWT|42501|disabled|didit/i;

describe.skip("verification_moderator_decide — introspecție validări (legacy, dormant)", () => {
  it("snapshot obsolet — se reactivează dacă fluxul intern revine", () => {
    /* intenționat vid */
  });
});

describe("verification_moderator_decide — refuz universal (Didit-only)", () => {
  const variants: Array<{ name: string; payload: Record<string, unknown> }> = [
    {
      name: "payload valid, apelant anonim",
      payload: {
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_decision: "approve",
        p_reason_code: "other",
        p_reason: "x".repeat(20),
        p_confidence: "medium",
      },
    },
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
      name: "needs_second cu confidence high",
      payload: {
        p_request_id: "00000000-0000-0000-0000-000000000000",
        p_decision: "needs_second",
        p_reason_code: "other",
        p_reason: "motiv suficient de lung pentru validare",
        p_confidence: "high",
      },
    },
  ];

  for (const v of variants) {
    it(`refuză ${v.name} (Didit-only / disabled / forbidden)`, async () => {
      const supabase = client();
      const { data, error } = await supabase.rpc(
        "verification_moderator_decide",
        v.payload as never,
      );
      expect(error).not.toBeNull();
      expect(data ?? null).toBeNull();
      expect(error?.message ?? "").toMatch(REJECTED);
    });
  }
});
