// Rendare fallback pentru poze HEIC existente în storage (înainte de fix-ul
// din PhotoManager/PrivateAlbum browserele nu le pot afișa). Detectează
// extensia `.heic/.heif` în URL, downloadează blob-ul și îl convertește la
// JPEG object URL. Cache in-memory ca să nu convertim de mai multe ori.

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function isHeicUrl(src: string): boolean {
  try {
    const noQuery = src.split("?")[0].toLowerCase();
    return noQuery.endsWith(".heic") || noQuery.endsWith(".heif");
  } catch {
    return false;
  }
}

export async function convertHeicUrl(src: string): Promise<string | null> {
  if (cache.has(src)) return cache.get(src)!;
  if (pending.has(src)) return pending.get(src)!;
  const p = (async () => {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const blob = await res.blob();
      const heic2any = (await import("heic2any")).default;
      const converted = (await heic2any({ blob, toType: "image/jpeg", quality: 0.85 })) as
        | Blob
        | Blob[];
      const out = Array.isArray(converted) ? converted[0] : converted;
      const url = URL.createObjectURL(out);
      cache.set(src, url);
      return url;
    } catch {
      return null;
    } finally {
      pending.delete(src);
    }
  })();
  pending.set(src, p);
  return p;
}
