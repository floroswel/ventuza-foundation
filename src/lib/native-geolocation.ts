// Wrapper geolocation — plugin @capacitor/geolocation pe Android, fallback web.
// API mimetează navigator.geolocation dar întoarce Promise-uri și numere de watch.

type Coords = { latitude: number; longitude: number; accuracy: number };
export type Position = { coords: Coords; timestamp: number };

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function getCurrentPosition(opts?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<Position | null> {
  if (await isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        const req = await Geolocation.requestPermissions();
        if (req.location !== "granted") return null;
      }
      const p = await Geolocation.getCurrentPosition({
        enableHighAccuracy: opts?.enableHighAccuracy ?? false,
        timeout: opts?.timeout ?? 15000,
        maximumAge: opts?.maximumAge ?? 60000,
      });
      return {
        coords: {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy ?? 0,
        },
        timestamp: p.timestamp,
      };
    } catch {
      return null;
    }
  }
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }, timestamp: p.timestamp }),
      () => resolve(null),
      { enableHighAccuracy: opts?.enableHighAccuracy ?? false, maximumAge: opts?.maximumAge ?? 60000, timeout: opts?.timeout ?? 15000 },
    );
  });
}

export type WatchHandle = { clear: () => void };

export async function watchPosition(
  cb: (p: Position) => void,
  err?: (e: Error) => void,
  opts?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
): Promise<WatchHandle> {
  if (await isNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        const req = await Geolocation.requestPermissions();
        if (req.location !== "granted") {
          err?.(new Error("Permisiune locație refuzată"));
          return { clear: () => {} };
        }
      }
      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: opts?.enableHighAccuracy ?? true,
          timeout: opts?.timeout ?? 15000,
        },
        (p, e) => {
          if (e) return err?.(new Error(e.message));
          if (!p) return;
          cb({
            coords: {
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracy: p.coords.accuracy ?? 0,
            },
            timestamp: p.timestamp,
          });
        },
      );
      return { clear: () => void Geolocation.clearWatch({ id }) };
    } catch (e) {
      err?.(e as Error);
      return { clear: () => {} };
    }
  }
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    err?.(new Error("Locația nu e disponibilă"));
    return { clear: () => {} };
  }
  const wid = navigator.geolocation.watchPosition(
    (p) => cb({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }, timestamp: p.timestamp }),
    (e) => err?.(new Error(e.message)),
    { enableHighAccuracy: opts?.enableHighAccuracy ?? true, maximumAge: opts?.maximumAge ?? 5000, timeout: opts?.timeout ?? 15000 },
  );
  return { clear: () => navigator.geolocation.clearWatch(wid) };
}
