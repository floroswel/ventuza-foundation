/**
 * Mascare UI pentru display_name vulgar/ofensator în panourile admin.
 * NU redenumește userul — doar ascunde textul în listări/drawer-uri.
 * Adminul poate vedea originalul cu hover/click pe indicator.
 */
const PATTERNS: RegExp[] = [
  // RO
  /\bpul[aă]\b/i,
  /\bpizd[aă]\b/i,
  /\bmuie\b/i,
  /\bcur\b/i,
  /\bcurv[aă]\b/i,
  /\bfut(e|em|ut|ai)?\b/i,
  /\bsug[e]?\s*pul[aă]\b/i,
  /\bcacat\b/i,
  // EN
  /\bfuck(er|ing)?\b/i,
  /\bshit\b/i,
  /\bbitch\b/i,
  /\bdick\b/i,
  /\bcunt\b/i,
  /\bnigg(a|er)\b/i,
  /\bpussy\b/i,
];

export function isOffensiveName(name: string | null | undefined): boolean {
  if (!name) return false;
  const s = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return PATTERNS.some((rx) => rx.test(s));
}

export function maskName(name: string | null | undefined): string {
  if (!name) return "(fără nume)";
  const first = name.trim().charAt(0);
  return first ? `${first}••• (nume flag-uit)` : "••• (nume flag-uit)";
}
