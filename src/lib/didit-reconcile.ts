/**
 * Selecție pură a sesiunilor Didit care trebuie re-interogate de cronul de
 * reconciliere (webhook pierdut sau întârziat). Fără DB / fără fetch —
 * testabilă unitar. Folosită de /api/public/cron/didit-reconcile.
 */

export type DiditSessionRow = {
  user_id: string;
  session_id: string;
  resolved_at: string | null;
  created_at: string;
};

export const DIDIT_REconcile_MIN_AGE_MS = 60 * 60 * 1000; // > 1 oră
export const DIDIT_REconcile_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // < 7 zile
export const DIDIT_REconcile_MAX_USERS = 50;

/**
 * Returnează user_id-uri distincte care au cel puțin o sesiune nerezolvată,
 * mai veche de 1 oră și mai nouă de 7 zile. Ordinea = cea mai veche sesiune
 * întâi (prioritate la conturile blocate de cel mai mult timp).
 */
export function pickDiditReconcileUserIds(
  sessions: ReadonlyArray<DiditSessionRow>,
  now: number = Date.now(),
): string[] {
  const oldestByUser = new Map<string, number>();
  for (const s of sessions) {
    if (s.resolved_at) continue;
    const created = Date.parse(s.created_at);
    if (!Number.isFinite(created)) continue;
    const age = now - created;
    if (age < DIDIT_REconcile_MIN_AGE_MS) continue; // prea proaspătă — webhook-ul poate încă ajunge
    if (age > DIDIT_REconcile_MAX_AGE_MS) continue; // prea veche — sesiunea Didit a expirat demult
    const prev = oldestByUser.get(s.user_id);
    if (prev === undefined || created < prev) oldestByUser.set(s.user_id, created);
  }
  return [...oldestByUser.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, DIDIT_REconcile_MAX_USERS)
    .map(([userId]) => userId);
}
