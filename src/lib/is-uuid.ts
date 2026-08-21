/**
 * Validare de format pentru ID-urile din URL. Rutele de detaliu primesc
 * parametrul direct din adresă; fără verificare, Postgres întoarce
 * `22P02 invalid input syntax for type uuid` iar ecranul rămâne blocat
 * pe „Se încarcă…". Cu verificarea, afișăm imediat starea „nu există".
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): boolean {
  return !!value && UUID_RE.test(value);
}
