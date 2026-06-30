/**
 * Integration tests — gates de securitate care nu trebuie slăbite.
 *
 * Acoperă:
 * 1) `assert_account_usable` impune email confirmat + age verified.
 * 2) `discover_profiles` apelează gate-ul ȘI păstrează rate limit
 *    (page size cap 50, 10 cereri/oră, inserare în rate_limit_log,
 *    excepție `discover_rate_limited`).
 * 3) `cleanup_rate_limit_log` păstrează fereastra de 7 zile.
 * 4) Comportament live anonymous: discover_profiles + assert_account_usable
 *    resping apelantul neautentificat (gate-ul rulează, nu e bypass).
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;

function client() {
  if (!url || !key) {
    throw new Error("Lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("Security invariants — introspecție RPC", () => {
  it("snapshot-ul confirmă toate gate-urile critice", async () => {
    const supabase = client();
    const { data, error } = await supabase.rpc("security_invariants_snapshot");
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const snap = data as Record<string, boolean>;

    // Email confirmation + age gate
    expect(snap.assert_account_usable_present).toBe(true);
    expect(snap.assert_checks_email_confirmed).toBe(true);
    expect(snap.assert_checks_age).toBe(true);

    // Discover wiring
    expect(snap.discover_present).toBe(true);
    expect(snap.discover_calls_assert_account_usable).toBe(true);

    // Rate limit + page cap (anti-scrape)
    expect(snap.discover_max_per_call_50).toBe(true);
    expect(snap.discover_max_calls_per_hour_10).toBe(true);
    expect(snap.discover_inserts_rate_limit_log).toBe(true);
    expect(snap.discover_raises_rate_limited).toBe(true);

    // Retenție log curățenie
    expect(snap.cleanup_present).toBe(true);
    expect(snap.cleanup_retains_7_days).toBe(true);
  });
});

describe("Security invariants — comportament live anonim", () => {
  it("assert_account_usable refuză apelantul anonim", async () => {
    const supabase = client();
    const { error } = await supabase.rpc("assert_account_usable");
    expect(error).not.toBeNull();
    // gate-ul rulează (nu primește răspuns OK fără sesiune)
    expect(error?.message ?? "").toMatch(
      /not_authenticated|permission|denied|forbidden|JWT/i,
    );
  });

  it("discover_profiles refuză apelantul anonim (gate activ)", async () => {
    const supabase = client();
    const { error } = await supabase.rpc("discover_profiles", {
      _viewer: "00000000-0000-0000-0000-000000000000",
      _limit: 30,
    });
    expect(error).not.toBeNull();
    // Acceptăm orice formă de refuz, dar NU vrem să vedem date returnate.
    expect(error?.message ?? "").toMatch(
      /forbidden|not_authenticated|permission|denied|JWT/i,
    );
  });

  it("discover_profiles cu _limit=9999 NU este permis anonim (cap-ul rămâne aplicat server-side)", async () => {
    const supabase = client();
    const { data, error } = await supabase.rpc("discover_profiles", {
      _viewer: "00000000-0000-0000-0000-000000000000",
      _limit: 9999,
    });
    // Gate-ul refuză înainte să se aplice limit-ul; oricum nu trebuie să
    // primim 9999 de rânduri. Dacă vreodată cineva mută capul în client,
    // testul de mai sus (snapshot) prinde regresia direct în SQL.
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
