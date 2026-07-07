// Resilient storage adapter pentru sesiunea Supabase.
//
// - Pe Capacitor nativ (WebView Android/iOS) folosim @capacitor/preferences,
//   care persistă în SharedPreferences / NSUserDefaults și nu e șters de
//   WebView storage clears sau ITP.
// - Pe web: încercăm localStorage; dacă e blocat (Safari Private Mode, quota
//   full, iframe cross-origin), cădem grațios pe un Map in-memory ca să nu
//   arunce eroare fatală. Sesiunea nu persistă între reload-uri în acest caz,
//   dar login-ul curent rămâne funcțional.
//
// Interfața acceptată de supabase-js: getItem/setItem/removeItem sync sau async.

type SupportedStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

function memoryStorage(): SupportedStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function webStorage(): SupportedStorage {
  // Probe localStorage — Safari Private Mode / cookies-blocked → throw.
  try {
    const probe = "__ventuza_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return {
      getItem: (k) => {
        try {
          return localStorage.getItem(k);
        } catch {
          return null;
        }
      },
      setItem: (k, v) => {
        try {
          localStorage.setItem(k, v);
        } catch {
          /* quota / disabled — silent */
        }
      },
      removeItem: (k) => {
        try {
          localStorage.removeItem(k);
        } catch {
          /* silent */
        }
      },
    };
  } catch {
    console.warn("[supabase-storage] localStorage indisponibil, fallback in-memory");
    return memoryStorage();
  }
}

function nativeStorage(): SupportedStorage {
  // Lazy import ca să nu se ceară în bundle-ul web unde plugin-ul nu există la runtime.
  const preferencesPromise = import("@capacitor/preferences").then((m) => m.Preferences);
  return {
    getItem: async (k) => {
      try {
        const P = await preferencesPromise;
        const { value } = await P.get({ key: k });
        return value ?? null;
      } catch {
        return null;
      }
    },
    setItem: async (k, v) => {
      try {
        const P = await preferencesPromise;
        await P.set({ key: k, value: v });
      } catch {
        /* silent */
      }
    },
    removeItem: async (k) => {
      try {
        const P = await preferencesPromise;
        await P.remove({ key: k });
      } catch {
        /* silent */
      }
    },
  };
}

export function getSupabaseStorage(): SupportedStorage | undefined {
  if (typeof window === "undefined") return undefined; // SSR
  try {
    // Detect Capacitor native (evită require-ul dacă plugin-ul nu e prezent).
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
      return nativeStorage();
    }
  } catch {
    /* fall through to web */
  }
  return webStorage();
}
