import { supabase } from "@/integrations/supabase/client";

/**
 * `get_public_profiles` și `list_visible_profiles` refuză server-side listele mai
 * mari de 200 de ID-uri (plafon anti-scraping — vezi migrarea de securitate).
 * Orice apelant trece prin helperul ăsta, care sparge lista în felii și le
 * reasamblează, ca UI-ul să nu vadă niciodată `too_many_ids`.
 */
export const PROFILE_RPC_MAX_IDS = 200;

type ProfileRpc = "get_public_profiles" | "list_visible_profiles";

export function chunkIds(ids: string[], size = PROFILE_RPC_MAX_IDS): string[][] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size));
  return out;
}

export async function fetchProfilesChunked<T = Record<string, unknown>>(
  fn: ProfileRpc,
  ids: string[],
): Promise<T[]> {
  const batches = chunkIds(ids);
  if (!batches.length) return [];
  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await (supabase.rpc as any)(fn, { _ids: batch });
      if (error) {
        console.error(`${fn} failed`, error);
        return [] as T[];
      }
      return (data ?? []) as T[];
    }),
  );
  return results.flat();
}
