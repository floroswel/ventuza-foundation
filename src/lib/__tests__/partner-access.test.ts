import { describe, it, expect } from "vitest";
import { assertPartner, PARTNER_ALLOWED_ROLES } from "@/lib/partner.functions";

/**
 * Integration test for partner access gate.
 * Verifies assertPartner accepts business/partner/admin/super_admin,
 * rejects other roles, and enforces suspension.
 */

const USER_ID = "00000000-0000-0000-0000-000000000001";

function makeSupabase(opts: {
  roles?: string[];
  rolesError?: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  profileError?: string;
  profileMissing?: boolean;
}) {
  const rolesRows = (opts.roles ?? []).map((role) => ({ role }));
  return {
    from(table: string) {
      if (table === "user_roles") {
        return {
          select() {
            return {
              eq: async () =>
                opts.rolesError
                  ? { data: null, error: { message: opts.rolesError } }
                  : { data: rolesRows, error: null },
            };
          },
        };
      }
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => {
                    if (opts.profileError) {
                      return { data: null, error: { message: opts.profileError } };
                    }
                    if (opts.profileMissing) {
                      return { data: null, error: null };
                    }
                    return {
                      data: {
                        partner_suspended_at: opts.suspendedAt ?? null,
                        partner_suspension_reason: opts.suspensionReason ?? null,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("assertPartner", () => {
  it("exports the canonical allow-list", () => {
    expect([...PARTNER_ALLOWED_ROLES].sort()).toEqual(
      ["admin", "business", "partner", "super_admin"].sort(),
    );
  });

  for (const role of PARTNER_ALLOWED_ROLES) {
    it(`accepts role "${role}"`, async () => {
      const supabase = makeSupabase({ roles: [role] });
      await expect(
        assertPartner({ supabase, userId: USER_ID }),
      ).resolves.toBeUndefined();
    });
  }

  it("accepts a user with mixed roles as long as one is allowed", async () => {
    const supabase = makeSupabase({ roles: ["user", "moderator", "business"] });
    await expect(
      assertPartner({ supabase, userId: USER_ID }),
    ).resolves.toBeUndefined();
  });

  for (const role of ["user", "moderator", "support", "auditor", "read_only"]) {
    it(`rejects role "${role}" with forbidden`, async () => {
      const supabase = makeSupabase({ roles: [role] });
      await expect(
        assertPartner({ supabase, userId: USER_ID }),
      ).rejects.toThrow(/forbidden: not a partner/);
    });
  }

  it("rejects a user with no roles", async () => {
    const supabase = makeSupabase({ roles: [] });
    await expect(
      assertPartner({ supabase, userId: USER_ID }),
    ).rejects.toThrow(/forbidden: not a partner/);
  });

  it("propagates the role-lookup DB error", async () => {
    const supabase = makeSupabase({ rolesError: "network down" });
    await expect(
      assertPartner({ supabase, userId: USER_ID }),
    ).rejects.toThrow(/network down/);
  });

  it("blocks a suspended partner even when role is allowed", async () => {
    const supabase = makeSupabase({
      roles: ["business"],
      suspendedAt: "2026-01-01T00:00:00Z",
      suspensionReason: "spam abuse",
    });
    await expect(
      assertPartner({ supabase, userId: USER_ID }),
    ).rejects.toThrow(/suspended: spam abuse/);
  });

  it("blocks a suspended partner with a fallback reason when none is provided", async () => {
    const supabase = makeSupabase({
      roles: ["admin"],
      suspendedAt: "2026-01-01T00:00:00Z",
      suspensionReason: null,
    });
    await expect(
      assertPartner({ supabase, userId: USER_ID }),
    ).rejects.toThrow(/suspended: see admin/);
  });

  it("passes when profile row is missing (no suspension flag)", async () => {
    const supabase = makeSupabase({ roles: ["partner"], profileMissing: true });
    await expect(
      assertPartner({ supabase, userId: USER_ID }),
    ).resolves.toBeUndefined();
  });

  it("propagates the profile-lookup DB error", async () => {
    const supabase = makeSupabase({
      roles: ["business"],
      profileError: "profile read failed",
    });
    await expect(
      assertPartner({ supabase, userId: USER_ID }),
    ).rejects.toThrow(/profile read failed/);
  });
});
