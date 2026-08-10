/**
 * Într-un flex column, un copil `flex-1` cu `overflow-*-auto` TREBUIE să aibă
 * și `min-h-0`.
 *
 * De ce: implicit, un element flex are `min-height: auto`, deci nu se poate
 * micșora sub înălțimea conținutului. Scroller-ul nu primește niciodată o cutie
 * mai mică decât ce conține, `overflow-y-auto` nu are ce să ascundă, și
 * derularea rămâne BLOCATĂ — conținutul de jos devine inaccesibil.
 *
 * Simptomul nu arată ca un bug de CSS: pare că „aplicația nu merge”, fiindcă
 * butoanele din josul unui formular nu se pot atinge. A apărut deja în Edit
 * Profile, în overlay-ul de Squad nou, în panoul de Filtre din Discover și în
 * navigația din Admin. Testul îl prinde o dată pentru totdeauna, în loc să
 * așteptăm următorul raport de pe telefon.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";

const files = globSync("src/**/*.tsx", { cwd: process.cwd() }).map((f) => String(f));

/** `flex-1` și un `overflow` de derulare în același className. */
const SCROLLER = /className=\{?["'`]([^"'`]*)["'`]/g;

function offendersIn(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(SCROLLER)) {
    const cls = m[1];
    const isFlexChild = /\bflex-1\b/.test(cls);
    const scrolls = /\boverflow(-[xy])?-auto\b|\boverflow(-[xy])?-scroll\b/.test(cls);
    if (isFlexChild && scrolls && !/\bmin-h-0\b/.test(cls)) {
      out.push(cls.replace(/\s+/g, " ").slice(0, 80));
    }
  }
  return out;
}

describe("containerele de derulare nu blochează scroll-ul", () => {
  it("scanează efectiv componentele — un test care nu citește nimic trece degeaba", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("fiecare `flex-1` cu overflow are și `min-h-0`", () => {
    const problems: string[] = [];
    for (const rel of files) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      for (const cls of offendersIn(src)) {
        problems.push(`${rel}: ${cls}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("detectorul funcționează", () => {
  it("prinde șablonul greșit", () => {
    expect(offendersIn(`<div className="flex-1 overflow-y-auto px-6">`)).toHaveLength(1);
  });

  it("acceptă șablonul corect", () => {
    expect(offendersIn(`<div className="min-h-0 flex-1 overflow-y-auto px-6">`)).toHaveLength(0);
  });

  it("nu se plânge de un scroller cu înălțime explicită", () => {
    // `max-h-[90vh] overflow-y-auto` (dialogurile) nu depinde de flex.
    expect(offendersIn(`<div className="max-h-[90vh] overflow-y-auto">`)).toHaveLength(0);
  });

  it("nu se plânge de `flex-1` fără derulare", () => {
    expect(offendersIn(`<div className="flex-1 px-6">`)).toHaveLength(0);
  });
});
