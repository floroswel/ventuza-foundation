/**
 * Offline persistence pentru TanStack Query.
 *
 * - Storage adapter dual: Capacitor Preferences pe nativ, localStorage pe web
 *   (cu fallback in-memory dacă localStorage e blocat — vezi
 *   integrations/supabase/storage-adapter.ts pentru pattern-ul echivalent).
 * - Persistăm SELECTIV — doar query-urile marcate în allowlist. Nimic legat
 *   de plăți, admin, verificări, break-glass, health, etc.
 * - `buster` legat de APP_VERSION → cache-ul este invalidat automat la
 *   fiecare release.
 * - `maxAge` 24h. Datele mai vechi sunt aruncate la restore.
 * - Reconectare: `onlineManager` este re-sincronizat cu evenimentul Capacitor
 *   Network dacă pluginul e disponibil, altfel cu navigator.onLine.
 */

import type { Query, QueryClient } from "@tanstack/react-query";
import { onlineManager } from "@tanstack/react-query";
import type { Persister } from "@tanstack/react-query-persist-client";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

import { APP_VERSION } from "./app-version";

// v2 invalidează definitiv payload-urile v1 cu forme vechi de conversații.
// Nu refolosim un cache incompatibil după deploy; datele se reîncarcă din DB.
const STORAGE_KEY = "suzeta:rq-cache:v2";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Allowlist strict de query keys care AU voie să fie persistate pe device.
 * Orice cheie care nu se potrivește este ignorată — payload-ul cache-ului
 * rămâne minim și fără date sensibile.
 *
 * NU adăuga aici:
 * - plăți / facturare (billing-*, invoice-*)
 * - admin (admin-*, ["admin", ...])
 * - break-glass / audit (sensitive-*, audit-*)
 * - health (health-*, hiv-*)
 * - sesiuni / token-uri (auth-*, session-*)
 * - verificare identitate (verification-*, didit-*)
 */
const PERSIST_ALLOWLIST: readonly string[] = [
  "conversations", // lista de conversații
  "conversation-messages", // mesajele recente per conversație (cap 50 în queryFn)
  "discover-seen", // profiluri deja văzute în discover
  "my-profile", // profilul propriu
];

function isPersistable(query: Query): boolean {
  const first = query.queryKey?.[0];
  if (typeof first !== "string") return false;
  return PERSIST_ALLOWLIST.includes(first);
}

type Native = {
  Preferences: {
    get: (o: { key: string }) => Promise<{ value: string | null }>;
    set: (o: { key: string; value: string }) => Promise<void>;
    remove: (o: { key: string }) => Promise<void>;
  };
};

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

function buildPersister(): Persister | null {
  if (typeof window === "undefined") return null;

  if (isCapacitorNative()) {
    // Async storage prin @capacitor/preferences (SharedPreferences / NSUserDefaults).
    const prefsPromise = import("@capacitor/preferences").then(
      (m) => (m as unknown as Native).Preferences,
    );
    return createAsyncStoragePersister({
      storage: {
        getItem: async (key: string) => {
          try {
            const P = await prefsPromise;
            const { value } = await P.get({ key });
            return value ?? null;
          } catch {
            return null;
          }
        },
        setItem: async (key: string, value: string) => {
          try {
            const P = await prefsPromise;
            await P.set({ key, value });
          } catch {
            /* silent */
          }
        },
        removeItem: async (key: string) => {
          try {
            const P = await prefsPromise;
            await P.remove({ key });
          } catch {
            /* silent */
          }
        },
      },
      key: STORAGE_KEY,
      throttleTime: 1500,
    });
  }

  // Web: localStorage cu probe (Safari private mode → skip persist).
  try {
    const probe = "__suzeta_rq_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch {
    return null;
  }
  return createSyncStoragePersister({
    storage: window.localStorage,
    key: STORAGE_KEY,
    throttleTime: 1500,
  });
}

/**
 * Setează persistența pe QueryClient. Idempotent — apelabil o singură dată
 * per client. Întoarce un cleanup pentru unmount.
 */
export function setupQueryPersistence(queryClient: QueryClient): () => void {
  const persister = buildPersister();
  if (!persister) return () => {};

  const [unsubscribe] = persistQueryClient({
    queryClient,
    persister,
    maxAge: MAX_AGE_MS,
    // Cache invalidat automat la orice change de versiune.
    buster: `v-${APP_VERSION}`,
    dehydrateOptions: {
      shouldDehydrateQuery: (q) => q.state.status === "success" && isPersistable(q),
    },
  });

  const netCleanup = wireOnlineManager(queryClient);

  return () => {
    unsubscribe?.();
    netCleanup();
  };
}

/**
 * Sincronizează onlineManager cu evenimentele reale de conectivitate.
 * Preferăm @capacitor/network pe nativ (detectează switch WiFi ↔ mobile
 * chiar și când navigator.onLine minte); fallback pe evenimentele web.
 * La reconectare, invalidăm query-urile stale pentru a forța refetch.
 */
function wireOnlineManager(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};

  let removeCapListener: (() => void) | null = null;
  let usingWeb = false;

  const setOnline = (online: boolean) => {
    onlineManager.setOnline(online);
    if (online) {
      // Refetch background pentru query-urile active + stale.
      void queryClient.invalidateQueries({ refetchType: "active" });
    }
  };

  if (isCapacitorNative()) {
    import("@capacitor/network")
      .then(async (mod) => {
        const Network = (mod as unknown as {
          Network: {
            getStatus: () => Promise<{ connected: boolean }>;
            addListener: (
              evt: string,
              cb: (s: { connected: boolean }) => void,
            ) => Promise<{ remove: () => Promise<void> }> | { remove: () => void };
          };
        }).Network;
        try {
          const status = await Network.getStatus();
          setOnline(status.connected);
        } catch {
          /* ignore */
        }
        try {
          const handle = await Network.addListener("networkStatusChange", (s) => {
            setOnline(s.connected);
          });
          removeCapListener = () => {
            try {
              void (handle as { remove: () => void | Promise<void> }).remove();
            } catch {
              /* silent */
            }
          };
        } catch {
          /* fallback to web listener below */
          usingWeb = true;
          attachWeb();
        }
      })
      .catch(() => {
        usingWeb = true;
        attachWeb();
      });
  } else {
    usingWeb = true;
    attachWeb();
  }

  function attachWeb() {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    removeCapListener = () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }

  return () => {
    removeCapListener?.();
    if (usingWeb) {
      /* handled by removeCapListener above */
    }
  };
}
