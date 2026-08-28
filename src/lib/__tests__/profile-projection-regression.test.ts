/**
 * Regresie — niciun RPC care returnează date despre ALȚI utilizatori nu are voie
 * să proiecteze:
 *   - `birthdate` exact (doar anul, via `make_date(...)`, și NULL când `hide_age`)
 *   - coordonate brute (`lat`/`lng`/`location`) ale unui profil
 *   - `distance_m` necalculat prin `bucket_distance_m`
 * și trebuie să filtreze blocările în ambele direcții.
 *
 * Echivalentul, pentru profiluri, al testului de confidențialitate a notificărilor.
 * Scanează ULTIMA definiție a fiecărei funcții din migrări — exact acolo unde a
 * apărut regresia istorică (`get_public_profiles` a reintrodus `p.birthdate`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Extrage corpul ultimei definiții a funcției din întregul istoric de migrări. */
function latestFunctionBody(name: string): { file: string; body: string } | null {
  let found: { file: string; body: string } | null = null;
  for (const f of files) {
    const src = readFileSync(join(MIGRATIONS, f), "utf8");
    const re = new RegExp(
      `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${name}\\s*\\(([\\s\\S]*?)\\$function\\$([\\s\\S]*?)\\$function\\$`,
      "gi",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      found = { file: f, body: m[2] };
    }
  }
  return found;
}

/** RPC-uri care proiectează profilul ALTOR utilizatori. */
const PROFILE_RPCS = [
  "get_public_profiles",
  "list_visible_profiles",
  "discover_profiles",
  "get_profile_by_slug",
] as const;

describe("Proiecții de profil — regresie confidențialitate", () => {
  it("toate RPC-urile de profil au o definiție în migrări (sanity check)", () => {
    for (const fn of PROFILE_RPCS) {
      expect(latestFunctionBody(fn), `lipsește definiția pentru ${fn}`).not.toBeNull();
    }
  });

  for (const fn of PROFILE_RPCS) {
    describe(fn, () => {
      const def = latestFunctionBody(fn);

      it("nu proiectează `birthdate` brut — doar anul, prin make_date()", () => {
        if (!def) return;
        expect(def.body, `în ${def.file}`).toMatch(/make_date\s*\(/i);
        // `p.birthdate` e permis DOAR ca argument al make_date sau pentru owner
        // (`WHEN p.id = v_me THEN p.birthdate`) și în filtre de vârstă (WHERE/AGE).
        const bareProjection = def.body
          .split("\n")
          .filter((line) => /^\s*(?:[a-z_]+\.)?birthdate\s*,?\s*$/i.test(line));
        expect(bareProjection, `proiecție brută de birthdate în ${def.file}`).toEqual([]);
      });

      it("respectă `hide_age`", () => {
        if (!def) return;
        expect(def.body, `în ${def.file}`).toMatch(/hide_age\s+IS\s+TRUE/i);
      });

      it("filtrează blocările în ambele direcții", () => {
        if (!def) return;
        expect(def.body, `în ${def.file}`).toMatch(/public\.blocks|FROM\s+blocks/i);
        expect(def.body).toMatch(/blocker_id/i);
        expect(def.body).toMatch(/blocked_id/i);
      });

      it("are gate de cont (assert_age_verified / assert_account_usable)", () => {
        if (!def) return;
        expect(def.body, `în ${def.file}`).toMatch(
          /assert_age_verified|assert_account_usable/i,
        );
      });

      it("nu proiectează coordonate brute ale profilului", () => {
        if (!def) return;
        expect(def.body, `în ${def.file}`).not.toMatch(
          /\bp\.(location|prev_location|travel_location)\b\s*,/i,
        );
        expect(def.body).not.toMatch(/ST_X\s*\(|ST_Y\s*\(|ST_AsText\s*\(/i);
      });
    });
  }

  it("distanța se întoarce doar bucketizată (discover_profiles)", () => {
    const def = latestFunctionBody("discover_profiles");
    if (!def) return;
    expect(def.body).toMatch(/bucket_distance_m\s*\(/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Escaladare de privilegii pe `profiles`
// ─────────────────────────────────────────────────────────────────────────────

describe("profiles — protecția coloanelor privilegiate", () => {
  function latestTriggerDdl(): string | null {
    let last: string | null = null;
    for (const f of files) {
      const src = readFileSync(join(MIGRATIONS, f), "utf8");
      const re =
        /CREATE\s+TRIGGER\s+prevent_profile_privilege_escalation([\s\S]*?);/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) last = m[0];
    }
    return last;
  }

  it("triggerul acoperă ȘI INSERT, nu doar UPDATE", () => {
    const ddl = latestTriggerDdl();
    expect(ddl, "nu am găsit CREATE TRIGGER prevent_profile_privilege_escalation").not.toBeNull();
    expect(ddl!).toMatch(/BEFORE\s+INSERT\s+OR\s+UPDATE/i);
  });

  it("funcția triggerului resetează câmpurile sensibile la INSERT", () => {
    const def = latestFunctionBody("prevent_profile_privilege_escalation");
    expect(def).not.toBeNull();
    expect(def!.body).toMatch(/TG_OP\s*=\s*'INSERT'/i);
    for (const col of [
      "banned_at",
      "banned_until",
      "verified",
      "age_status",
      "boosts_balance",
      "super_taps_balance",
      "xp",
      "risk_score",
      "suspended_until",
      "deleted_at",
    ]) {
      expect(def!.body, `INSERT nu resetează ${col}`).toMatch(
        new RegExp(`NEW\\.${col}\\s*:=`, "i"),
      );
    }
  });
});
