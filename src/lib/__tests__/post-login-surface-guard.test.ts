/**
 * CI guard — post-login surface.
 *
 * Reguli pe care le impunem static (grep-uri deterministe, fără browser):
 *
 * 1) `LanguageToggle` / `LanguageSwitcher` NU sunt importate în afara
 *    fluxului de auth (rute publice `/auth*`, `/reset-password`) sau a
 *    propriilor lor fișiere sursă. După logare nu există nicio suprafață
 *    care schimbă limba din UI.
 *
 * 2) Componenta `LanguageToggle` conține gate-urile stricte de sesiune +
 *    path (`session`, `loading`, `isPublicAuthRoute`) — dacă cineva le
 *    șterge, testul cade.
 *
 * 3) Nicio rută autentificată nu solicită direct camera prin
 *    `getUserMedia({ video: ... })`. Singurul loc unde camera se
 *    inițiază pentru selfie liveness este fluxul Didit hosted, care
 *    rulează pe verify.didit.me (nu în DOM-ul aplicației). Componenta
 *    `verify.tsx` doar redirecționează către URL-ul hosted.
 *
 * Dacă un feature nou are nevoie legitimă de cameră (ex: story recorder),
 * marchează fișierul cu comentariul `// privacy:camera-allowed <motiv>`
 * pe aceeași linie ca apelul `getUserMedia`, iar testul îl exceptează.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, acc);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(SRC);
const read = (p: string) => readFileSync(p, "utf8");
const rel = (p: string) => relative(process.cwd(), p);

describe("Post-login surface guard", () => {
  it("LanguageToggle/Switcher nu sunt importate în afara fluxului /auth", () => {
    // Fișierele care AU voie să importe cele două componente.
    const allowed = new Set<string>([
      "src/routes/__root.tsx", // gate strict în componentă
      "src/components/LanguageToggle.tsx",
      "src/components/LanguageSwitcher.tsx",
      "src/routes/auth.tsx",
      "src/routes/auth.check-email.tsx",
      "src/routes/reset-password.tsx",
    ]);

    const offenders: string[] = [];
    for (const f of files) {
      const r = rel(f).replaceAll("\\", "/");
      if (allowed.has(r)) continue;
      const src = read(f);
      if (
        /from\s+["']@\/components\/LanguageToggle["']/.test(src) ||
        /from\s+["']@\/components\/LanguageSwitcher["']/.test(src)
      ) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `Language UI importat în afara fluxului de auth (post-login): ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("LanguageToggle păstrează gate-urile stricte (session + loading + isPublicAuthRoute)", () => {
    const src = read(join(SRC, "components/LanguageToggle.tsx"));
    expect(src).toMatch(/useAuth\(/);
    expect(src).toMatch(/if\s*\(\s*loading\s*\)\s*return\s+null/);
    expect(src).toMatch(/if\s*\(\s*session\s*\)\s*return\s+null/);
    expect(src).toMatch(/isPublicAuthRoute/);
  });

  it("Niciun cod app nu apelează getUserMedia fără marcaj explicit", () => {
    const offenders: { file: string; line: number; text: string }[] = [];
    for (const f of files) {
      const src = read(f);
      if (!src.includes("getUserMedia")) continue;
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (!/getUserMedia\s*\(/.test(line)) return;
        if (/privacy:camera-allowed/.test(line)) return; // exceptare explicită
        offenders.push({ file: rel(f), line: i + 1, text: line.trim() });
      });
    }
    expect(
      offenders,
      `Apeluri getUserMedia neexceptate: ${offenders
        .map((o) => `${o.file}:${o.line} → ${o.text}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("Fluxul de verify NU montează un <video> local; folosește URL hosted Didit", () => {
    const src = read(join(SRC, "routes/verify.tsx"));
    // Interzicem introducerea unui `<video` sau `srcObject` (semnal clar de camera live in-app).
    expect(src).not.toMatch(/<video[\s>]/);
    expect(src).not.toMatch(/srcObject\s*=/);
    // Trebuie să existe navigarea către URL-ul hosted (top-level, nu iframe).
    expect(src).toMatch(/window\.(top\.)?location|window\.open/);
  });
});
