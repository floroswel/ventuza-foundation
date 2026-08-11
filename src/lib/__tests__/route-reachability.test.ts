/**
 * O funcție care nu poate fi atinsă apăsând nimic în aplicație nu există
 * pentru utilizator.
 *
 * `/explore` (243 de linii, evenimente și locuri) și `/groups` erau pagini
 * complete cu ZERO link-uri către ele — apăreau doar în listele de rute ale
 * AgeGate și QuickExitFab, care nu sunt navigație. Se putea ajunge la ele doar
 * tastând URL-ul.
 *
 * Testul cere ca fiecare rută de funcționalitate să aibă cel puțin o intrare
 * (`<Link to>` sau `navigate({ to })`) din alt fișier.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROUTES_DIR = resolve(process.cwd(), "src/routes");
const SRC_DIR = resolve(process.cwd(), "src");

/**
 * Rute care NU au nevoie de link în interfață: ecrane de sistem, pagini legale
 * atinse din footer generat, zone de admin/partener, rute cu parametru și
 * puncte de intrare tehnice.
 */
const NO_LINK_NEEDED = [
  /^__root$/,
  /^index$/,
  /^api$/,
  /^mcp\.ts$/,
  /\$/, // rute cu parametru: /u/$slug, /events/$id…
  /^legal\./,
  /^admin/,
  /^partner/,
  /^business/,
  /^advertise/,
  /^auth/,
  /^\[/, // [.]lovable.oauth.consent, [.well-known]…
  /^README/,
  /^onboarding$/,
  /^n$/, // pasul de onboarding, redirect programatic
  /^reset-password$/,
  /^blocked/,
  /^status$/,
  /^lovable$/,
  /^sale-pitch$/,
  /^account-deletion$/,
];

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.includes(".test.")) out.push(full);
  }
  return out;
}

const featureRoutes = readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => f.replace(/\.tsx$/, ""))
  .filter((name) => !NO_LINK_NEEDED.some((re) => re.test(name)))
  // `messages.index` etc. sunt aceeași rută cu părintele.
  .filter((name) => !name.endsWith(".index"))
  .map((name) => `/${name.split(".")[0]}`)
  .filter((v, i, a) => a.indexOf(v) === i);

const sources = collectSourceFiles(SRC_DIR).map((f) => ({
  path: f,
  text: readFileSync(f, "utf8"),
}));

/** Doar navigație reală: `to="/x"` sau `to: "/x"`. Nu liste de rute. */
function hasInboundLink(route: string): boolean {
  const patterns = [
    new RegExp(`to=["']${route}["']`),
    new RegExp(`to:\\s*["']${route}["']`),
  ];
  return sources.some((s) => {
    // Un ecran care se auto-referă nu se face accesibil singur.
    if (s.path.includes(join("routes", route.slice(1)))) return false;
    return patterns.some((p) => p.test(s.text));
  });
}

describe("fiecare funcție este accesibilă din interfață", () => {
  it("există rute de analizat", () => {
    expect(featureRoutes.length).toBeGreaterThan(5);
  });

  it.each(featureRoutes)("%s are cel puțin un link din aplicație", (route) => {
    expect(hasInboundLink(route)).toBe(true);
  });
});
