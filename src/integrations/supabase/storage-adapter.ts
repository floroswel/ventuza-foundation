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
    const probe = "__suzeta_probe__";
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
  const fallback = webStorage();
  const within = async <T,>(operation: Promise<T>, fallbackValue: T, timeoutMs = 4000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((resolve) => {
          timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  return {
    getItem: async (k) => {
      // localStorage este sursa rapidă pentru sesiunea curentă. Preferences este
      // folosit doar ca recuperare după ce WebView și-a pierdut storage-ul.
      const localValue = await fallback.getItem(k);
      if (localValue !== null) return localValue;
      try {
        const P = await within(preferencesPromise, null, 500);
        if (!P) return null;
        const result = await within(P.get({ key: k }), { value: null });
        if (result.value !== null) await fallback.setItem(k, result.value);
        return result.value;
      } catch {
        return null;
      }
    },
    setItem: async (k, v) => {
      // Supabase așteaptă storage.setItem înainte să rezolve signIn/signUp.
      // Scriem întâi în WebView (rapid), apoi persistăm nativ.
      //
      // Pentru CHEIA DE SESIUNE așteptăm scrierea nativă (cu timeout scurt):
      // dacă procesul e ucis de Android imediat după login, copia din
      // SharedPreferences trebuie să existe deja, altfel la următoarea
      // deschidere userul apare deconectat (WebView-ul își poate pierde
      // localStorage-ul la evict).
      await fallback.setItem(k, v);
      const isSession = k.startsWith("sb-") && k.includes("auth-token");
      const write = preferencesPromise
        .then((P) => within(P.set({ key: k, value: v }), undefined, 1500))
        .catch(() => undefined);
      if (isSession) await write;
      else void write;
    },

    removeItem: async (k) => {
      await fallback.removeItem(k);
      void preferencesPromise
        .then((P) => within(P.remove({ key: k }), undefined))
        .catch(() => undefined);
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
