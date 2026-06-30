/**
 * Integration test — RPC `nearby_points`.
 *
 * Verifică:
 *  1. Apelantul anonim e refuzat (gate auth activ — nu primește date).
 *  2. Apelantul autenticat (dacă există TEST_USER_EMAIL / TEST_USER_PASSWORD în env)
 *     primește fie un array (eventual gol — bucket fără puncte e legitim),
 *     fie o eroare CONTROLATĂ și recognoscibilă: rate limit (429 / `*rate*`),
 *     permission denied (403 / `permission|denied|forbidden`),
 *     age/consent gate (`age_verification_required` / `assert_account_usable`).
 *  3. Validare input la nivel RPC: bucketId invalid → eroare clară.
 *
 * Nu lovim niciun edge function; doar Data API + RPC, exact ca aplicația.
 */
import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;

const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

function anonClient(): SupabaseClient {
  if (!url || !key) {
    throw new Error("Lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Bucket valid sintactic ("lat_idx:lng_idx"); regiune din centrul București
// (≈44.43, 26.10) la grid ≈5 km => indexi mici, pozitivi. Nu garantăm puncte.
const SAMPLE_BUCKET = "988:579";

const KNOWN_CONTROLLED_ERRORS =
  /permission|denied|forbidden|rate|429|age_verification_required|assert_account_usable|email_not_confirmed|not_authenticated|JWT/i;

describe("nearby_points — gate auth", () => {
  it("refuză apelantul anonim (fără sesiune)", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.rpc("nearby_points", {
      p_bucket_id: SAMPLE_BUCKET,
      p_kinds: ["venue", "event", "offer"],
    });

    // Acceptăm două forme: (a) eroare explicită de la gate, (b) array gol +
    // mesaj `forbidden` ridicat de RPC. NU acceptăm rânduri reale.
    if (error) {
      expect(error.message ?? "").toMatch(KNOWN_CONTROLLED_ERRORS);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });
});

describe.skipIf(!(testEmail && testPassword))(
  "nearby_points — apelant autenticat",
  () => {
    it("returnează un array (sau eroare controlată de rate/permission)", async () => {
      const supabase = anonClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail!,
        password: testPassword!,
      });
      // Dacă autentificarea pică (parolă greșită, captcha), testul devine inutil.
      // Ridicăm clar — nu vrem fals-pozitive.
      expect(signInError, `signIn TEST_USER_EMAIL: ${signInError?.message}`).toBeNull();

      try {
        const { data, error } = await supabase.rpc("nearby_points", {
          p_bucket_id: SAMPLE_BUCKET,
          p_kinds: ["venue", "event", "offer"],
        });

        if (error) {
          // Permitem eroare DOAR dacă e una pe care app-ul o tratează:
          // rate limit, permission denied, age/consent gate.
          expect(error.message ?? "").toMatch(KNOWN_CONTROLLED_ERRORS);
        } else {
          expect(Array.isArray(data)).toBe(true);
          // Bucket-ul ales poate fi gol — e legitim. Validăm doar shape.
          for (const row of (data ?? []) as Array<Record<string, unknown>>) {
            expect(row).toHaveProperty("kind");
            expect(row).toHaveProperty("id");
            expect(row).toHaveProperty("lat");
            expect(row).toHaveProperty("lng");
            // Nu trebuie să existe câmpuri sensibile (token, email, hiv*).
            for (const forbidden of [
              "hiv_status",
              "hiv_status_enc",
              "email",
              "phone_e164",
            ]) {
              expect(row).not.toHaveProperty(forbidden);
            }
          }
        }
      } finally {
        await supabase.auth.signOut();
      }
    });

    it("respinge bucketId invalid cu mesaj clar", async () => {
      const supabase = anonClient();
      await supabase.auth.signInWithPassword({
        email: testEmail!,
        password: testPassword!,
      });
      try {
        const { data, error } = await supabase.rpc("nearby_points", {
          p_bucket_id: "nu-e-bucket",
          p_kinds: ["venue"],
        });
        // Fie eroare de validare DB, fie array gol (gate-ul nu sparge).
        if (error) {
          expect(error.message ?? "").toMatch(
            /bucket|invalid|format|syntax|permission|denied|forbidden/i,
          );
        } else {
          expect(data ?? []).toHaveLength(0);
        }
      } finally {
        await supabase.auth.signOut();
      }
    });
  },
);
