// Client-side cache for badge lookups.
//
// Avoids re-fetching the same user/venue badges when the user navigates back
// to Discover/Nearby, when the list re-renders, or when overlapping IDs appear
// across paginated batches. The cache is process-local (module scope) and
// intentionally not persisted: badge state can change server-side (streak
// expires, verification revoked, boost ends) and we want a fresh value at
// least once per session and once per TTL window.
//
// Concurrency: identical in-flight batches are deduplicated so parallel
// consumers share a single network round-trip.

import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef } from "react";
import { getUserBadgesBatch, getVenueBadgesBatch } from "@/lib/badges.functions";

const TTL_MS = 5 * 60 * 1000; // 5 minutes — matches server badge freshness expectations.

type Entry = { badges: string[]; expiresAt: number };
type Fetcher<TArg, TRow> = (args: {
  data: TArg;
}) => Promise<{ rows: TRow[] }>;

function now() {
  return Date.now();
}

function makeStore<TKey extends string>() {
  const store = new Map<TKey, Entry>();
  const inflight = new Map<TKey, Promise<string[]>>();
  return { store, inflight };
}

const userStore = makeStore<string>();
const venueStore = makeStore<string>();

function readFresh(store: Map<string, Entry>, ids: string[]) {
  const hits: Record<string, string[]> = {};
  const misses: string[] = [];
  const t = now();
  for (const id of ids) {
    const cached = store.get(id);
    if (cached && cached.expiresAt > t) {
      hits[id] = cached.badges;
    } else {
      misses.push(id);
    }
  }
  return { hits, misses };
}

async function fetchWithCache<TArg extends Record<string, string[]>, TRow>(
  ids: string[],
  cache: { store: Map<string, Entry>; inflight: Map<string, Promise<string[]>> },
  buildArg: (missing: string[]) => TArg,
  fetcher: Fetcher<TArg, TRow>,
  extractId: (row: TRow) => string,
  extractBadges: (row: TRow) => string[],
): Promise<Record<string, string[]>> {
  if (ids.length === 0) return {};
  const uniq = Array.from(new Set(ids));
  const { hits, misses } = readFresh(cache.store, uniq);

  // Deduplicate in-flight per-id lookups.
  const pending: Promise<string[]>[] = [];
  const toFetch: string[] = [];
  for (const id of misses) {
    const p = cache.inflight.get(id);
    if (p) pending.push(p);
    else toFetch.push(id);
  }

  if (toFetch.length > 0) {
    const promise = fetcher({ data: buildArg(toFetch) })
      .then(({ rows }) => {
        const t = now();
        const map = new Map<string, string[]>();
        for (const row of rows) {
          const id = extractId(row);
          const badges = extractBadges(row) ?? [];
          map.set(id, badges);
          cache.store.set(id, { badges, expiresAt: t + TTL_MS });
        }
        // Cache negatives too so we don't refetch empty results in a hot loop.
        for (const id of toFetch) {
          if (!map.has(id)) {
            cache.store.set(id, { badges: [], expiresAt: t + TTL_MS });
            map.set(id, []);
          }
        }
        return { toFetch, map };
      })
      .finally(() => {
        for (const id of toFetch) cache.inflight.delete(id);
      });

    // Register a per-id promise resolving to its own badge list.
    for (const id of toFetch) {
      cache.inflight.set(
        id,
        promise.then(({ map }) => map.get(id) ?? []),
      );
      pending.push(cache.inflight.get(id)!);
    }
  }

  const results: Record<string, string[]> = { ...hits };
  if (pending.length > 0) {
    await Promise.all(
      misses.map(async (id) => {
        const p = cache.inflight.get(id);
        if (p) results[id] = await p;
        else {
          const cached = cache.store.get(id);
          results[id] = cached?.badges ?? [];
        }
      }),
    );
  }
  return results;
}

export function invalidateBadgesCache(kind?: "user" | "venue") {
  if (!kind || kind === "user") {
    userStore.store.clear();
    userStore.inflight.clear();
  }
  if (!kind || kind === "venue") {
    venueStore.store.clear();
    venueStore.inflight.clear();
  }
}

export function useCachedUserBadges() {
  const fn = useServerFn(getUserBadgesBatch);
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(async (userIds: string[]) => {
    return fetchWithCache(
      userIds,
      userStore,
      (missing) => ({ userIds: missing }),
      ref.current as Fetcher<{ userIds: string[] }, { user_id: string; badges: string[] }>,
      (r) => r.user_id,
      (r) => r.badges,
    );
  }, []);
}

export function useCachedVenueBadges() {
  const fn = useServerFn(getVenueBadgesBatch);
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(async (venueIds: string[]) => {
    return fetchWithCache(
      venueIds,
      venueStore,
      (missing) => ({ venueIds: missing }),
      ref.current as Fetcher<{ venueIds: string[] }, { venue_id: string; badges: string[] }>,
      (r) => r.venue_id,
      (r) => r.badges,
    );
  }, []);
}
