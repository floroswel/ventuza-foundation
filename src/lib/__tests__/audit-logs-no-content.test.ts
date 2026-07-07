/**
 * Regresie — `notification_dispatch_log` și `admin_audit_log` NU pot conține
 * conținut de mesaj (`body`, `caption`, `text`, `body_preview`,
 * `last_message_preview`, `message_body`) sau detalii despre media
 * (`media_type`, `media_url`, `voice_url`) — nici la emitere (INSERT în SQL /
 * apeluri din TS), nici la consultare (SELECT în server fns de admin).
 *
 * Testul rulează static peste sursă (TS + migrări SQL). Verifică:
 *  1. Schema tabelelor nu include coloane interzise (introspecție migrări).
 *  2. Niciun INSERT în cele două tabele nu proiectează câmpuri interzise.
 *  3. Niciun SELECT în server fns de admin (`admin-user-notifications`,
 *     `admin-enterprise` etc.) nu proiectează câmpuri interzise pe aceste tabele.
 *  4. Payload-ul JSONB (`after_data`, `before_data`) al `admin_audit_log`
 *     nu conține chei interzise când este construit ca `jsonb_build_object`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (abs: string) => readFileSync(abs, "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const srcFiles = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !/__tests__/.test(f));
const sqlFiles = walk(MIGRATIONS).filter((f) => f.endsWith(".sql"));

const AUDIT_TABLES = ["notification_dispatch_log", "admin_audit_log"] as const;

const FORBIDDEN_FIELDS = [
  "body",
  "body_preview",
  "last_message_preview",
  "message_body",
  "caption",
  "text",
  "media_type",
  "media_url",
  "voice_url",
] as const;

// Regex matcher pentru un token de câmp/coloană interzis (evită false positives
// pe cuvinte care conțin substring: acceptă doar `body`, nu `nobody`).
function forbiddenTokenRegex(field: string): RegExp {
  // \b nu funcționează cu underscore, dar toate câmpurile noastre sunt tokenizate
  // cu boundary alfanumeric — folosim (?<![A-Za-z0-9_]) / (?![A-Za-z0-9_]).
  return new RegExp(`(?<![A-Za-z0-9_])${field}(?![A-Za-z0-9_])`, "gi");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SCHEMĂ — coloanele tabelelor nu includ câmpuri interzise
// ─────────────────────────────────────────────────────────────────────────────
describe("audit tables schema — no content columns", () => {
  // Extrag numele coloanelor dintr-un bloc CREATE TABLE (...): fiecare linie de
  // definiție începe cu un identifier — restul e tipul.
  function columnNames(createBody: string): string[] {
    const names: string[] = [];
    for (const rawLine of createBody.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/,$/, "");
      if (!line) continue;
      // Sarim peste CONSTRAINT / PRIMARY / FOREIGN / CHECK / UNIQUE / EXCLUDE
      if (/^(CONSTRAINT|PRIMARY|FOREIGN|CHECK|UNIQUE|EXCLUDE|LIKE)\b/i.test(line)) continue;
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\b/);
      if (m) names.push(m[1].toLowerCase());
    }
    return names;
  }

  for (const table of AUDIT_TABLES) {
    it(`${table} does not declare forbidden content columns`, () => {
      const offenders: Array<{ file: string; column: string }> = [];

      const createRe = new RegExp(
        `CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\)\\s*;`,
        "gi",
      );
      const addColRe = new RegExp(
        `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ADD\\s+COLUMN(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+([A-Za-z_][A-Za-z0-9_]*)`,
        "gi",
      );
      const renameRe = new RegExp(
        `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+RENAME\\s+COLUMN\\s+\\w+\\s+TO\\s+([A-Za-z_][A-Za-z0-9_]*)`,
        "gi",
      );

      const forbiddenSet = new Set(FORBIDDEN_FIELDS.map((f) => f.toLowerCase()));

      for (const f of sqlFiles) {
        const src = read(f);
        for (const m of src.matchAll(createRe)) {
          for (const col of columnNames(m[1])) {
            if (forbiddenSet.has(col)) offenders.push({ file: f, column: col });
          }
        }
        for (const m of src.matchAll(addColRe)) {
          const col = m[1].toLowerCase();
          if (forbiddenSet.has(col)) offenders.push({ file: f, column: col });
        }
        for (const m of src.matchAll(renameRe)) {
          const col = m[1].toLowerCase();
          if (forbiddenSet.has(col)) offenders.push({ file: f, column: col });
        }
      }

      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
    });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// 2. INSERT — SQL migrations & TS server fns nu introduc câmpuri interzise
// ─────────────────────────────────────────────────────────────────────────────
describe("audit tables writes — no forbidden fields in INSERT / .insert()", () => {
  for (const table of AUDIT_TABLES) {
    it(`SQL INSERT INTO ${table} never lists forbidden columns`, () => {
      const offenders: Array<{ file: string; snippet: string; field: string }> = [];
      const insertRe = new RegExp(
        `INSERT\\s+INTO\\s+(?:public\\.)?${table}\\s*\\(([^)]*)\\)`,
        "gi",
      );

      for (const f of sqlFiles) {
        const src = read(f);
        for (const m of src.matchAll(insertRe)) {
          const cols = m[1];
          for (const field of FORBIDDEN_FIELDS) {
            if (forbiddenTokenRegex(field).test(cols)) {
              offenders.push({ file: f, snippet: m[0], field });
            }
          }
        }
      }

      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
    });

    it(`TS .from("${table}").insert(...) never sets forbidden fields`, () => {
      const offenders: Array<{ file: string; snippet: string; field: string }> = [];
      // Cauta .from("<table>") urmat de .insert({...}) în același bloc scurt.
      const fromRe = new RegExp(
        `\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)[\\s\\S]{0,600}?\\.insert\\(\\s*(\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\s*\\)`,
        "g",
      );

      for (const f of srcFiles) {
        const src = read(f);
        for (const m of src.matchAll(fromRe)) {
          const payload = m[1];
          for (const field of FORBIDDEN_FIELDS) {
            if (forbiddenTokenRegex(field).test(payload)) {
              offenders.push({ file: f, snippet: m[0].slice(0, 300), field });
            }
          }
        }
      }

      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SELECT — server fns admin nu proiectează câmpuri interzise pe aceste tabele
// ─────────────────────────────────────────────────────────────────────────────
describe("audit tables reads — no forbidden fields in .select() projection", () => {
  for (const table of AUDIT_TABLES) {
    it(`TS .from("${table}").select(...) never projects forbidden fields`, () => {
      const offenders: Array<{ file: string; snippet: string; field: string }> = [];
      // Interzicem în special `select("*")` (poate proiecta orice coloană viitoare).
      const selectRe = new RegExp(
        `\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)[\\s\\S]{0,300}?\\.select\\(\\s*["'\`]([^"'\`]+)["'\`]\\s*\\)`,
        "g",
      );
      const selectStarRe = new RegExp(
        `\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)[\\s\\S]{0,300}?\\.select\\(\\s*["'\`]\\*["'\`]\\s*\\)`,
        "g",
      );

      for (const f of srcFiles) {
        const src = read(f);

        // 3a. select("*") pe tabelele de audit e interzis (proiecție necontrolată).
        for (const m of src.matchAll(selectStarRe)) {
          offenders.push({
            file: f,
            snippet: m[0].slice(0, 200),
            field: "SELECT * (proiecție necontrolată)",
          });
        }

        // 3b. proiecție explicită — inspectăm lista de coloane.
        for (const m of src.matchAll(selectRe)) {
          const projection = m[1];
          if (projection.trim() === "*") continue; // deja capturat mai sus
          for (const field of FORBIDDEN_FIELDS) {
            if (forbiddenTokenRegex(field).test(projection)) {
              offenders.push({ file: f, snippet: m[0].slice(0, 200), field });
            }
          }
        }
      }

      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. jsonb_build_object în triggere / helpere SQL nu introduce chei interzise
//    în after_data/before_data când tabela vizată este admin_audit_log sau
//    notification_dispatch_log (append-only).
// ─────────────────────────────────────────────────────────────────────────────
describe("audit tables JSONB payload — no forbidden keys in jsonb_build_object", () => {
  for (const table of AUDIT_TABLES) {
    it(`INSERT INTO ${table} ... VALUES(... jsonb_build_object(...)) has no forbidden keys`, () => {
      const offenders: Array<{ file: string; snippet: string; field: string }> = [];
      // Prindem întregul statement INSERT INTO <table> ... ; și inspectăm
      // orice jsonb_build_object(...) din el.
      const insertStmtRe = new RegExp(
        `INSERT\\s+INTO\\s+(?:public\\.)?${table}\\b[\\s\\S]*?;`,
        "gi",
      );
      const jsonbRe = /jsonb_build_object\s*\(([\s\S]*?)\)/gi;

      for (const f of sqlFiles) {
        const src = read(f);
        for (const stmt of src.matchAll(insertStmtRe)) {
          for (const jb of stmt[0].matchAll(jsonbRe)) {
            const args = jb[1];
            // Cheile sunt literale între ghilimele simple ('key', value, ...).
            const keys = [...args.matchAll(/'([^']+)'\s*,/g)].map((k) => k[1]);
            for (const field of FORBIDDEN_FIELDS) {
              if (keys.includes(field)) {
                offenders.push({ file: f, snippet: jb[0].slice(0, 200), field });
              }
            }
          }
        }
      }

      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
    });
  }
});
