/**
 * Integration test — regression guard pentru eroarea:
 *   "invalid input value for enum app_role: \"partner\""
 *
 * Cauza inițială: `admin-partners.functions.ts` interoga `user_roles` cu
 * `role='partner'` dar enum-ul `public.app_role` nu conținea valoarea.
 * Acest test prinde din nou regresia dacă cineva renunță la valoare sau
 * redenumește enum-ul.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

describe("public.app_role enum", () => {
  it("conține valoarea 'partner' (regresie admin-partners)", async () => {
    if (!url || !key) {
      throw new Error("Lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc("app_role_values");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    const values = (data as string[]) ?? [];
    expect(values).toContain("partner");
    // Sanity — alte roluri folosite în cod
    expect(values).toEqual(expect.arrayContaining(["admin", "moderator", "user", "super_admin"]));
  });

  it("interogarea user_roles cu role='partner' NU aruncă enum error", async () => {
    if (!url || !key) {
      throw new Error("Lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // RLS blochează anon din user_roles (rezultatul e []), dar parsing-ul
    // enum-ului are loc înainte de RLS. Dacă 'partner' lipsește din enum,
    // PostgREST returnează `invalid input value for enum app_role`.
    const { error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "partner")
      .limit(1);

    if (error) {
      expect(error.message).not.toMatch(/invalid input value for enum app_role/i);
    }
  });
});
