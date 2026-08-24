// <img> wrapper cu:
//  - conversie HEIC/HEIF → JPEG (poze urcate înainte de fix-ul de upload),
//  - retry cu backoff exponențial când încărcarea eșuează,
//  - re-semnare automată a URL-ului când `bucket` + `path` sunt cunoscute
//    (URL semnat expirat / cache stricat),
//  - fallback vizual, ca UX-ul să rămână fluid.
import { useCallback, useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { convertHeicUrl, isHeicUrl } from "@/lib/heic-fallback";
import { bustCache, MAX_IMAGE_RETRIES, retryDelay } from "@/lib/image-retry";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  /** Bucket Supabase pentru re-semnare la eșec. */
  bucket?: string;
  /** Calea din bucket pentru re-semnare la eșec. */
  path?: string | null;
  /** Imagine afișată după epuizarea reîncercărilor. */
  fallbackSrc?: string;
};

export function SmartImage(props: Props) {
  const { src, bucket, path, fallbackSrc, onError, ...rest } = props;
  const [resolved, setResolved] = useState<string | undefined>(
    typeof src === "string" && isHeicUrl(src) ? undefined : (src as string | undefined),
  );
  const [failed, setFailed] = useState(false);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attemptRef.current = 0;
    setFailed(false);
    if (typeof src !== "string") {
      setResolved(undefined);
      return;
    }
    if (!isHeicUrl(src)) {
      setResolved(src);
      return;
    }
    let cancelled = false;
    setResolved(undefined);
    void convertHeicUrl(src).then((url) => {
      if (!cancelled) setResolved(url ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleError = useCallback<NonNullable<ImgHTMLAttributes<HTMLImageElement>["onError"]>>(
    (event) => {
      onError?.(event);
      const attempt = attemptRef.current;
      if (attempt >= MAX_IMAGE_RETRIES) {
        setFailed(true);
        if (fallbackSrc) setResolved(fallbackSrc);
        return;
      }
      attemptRef.current = attempt + 1;

      timerRef.current = setTimeout(() => {
        void (async () => {
          // 1) Dacă știm bucket + path, invalidăm cache-ul și re-semnăm.
          if (bucket && path) {
            try {
              const mod = await import("@/lib/signed-url-cache");
              mod.invalidateSignedUrl(bucket, path);
              const fresh = await mod.getSignedUrl(bucket, path);
              if (fresh) {
                setResolved(bustCache(fresh, attempt + 1));
                return;
              }
            } catch {
              /* cădem pe retry simplu */
            }
          }
          // 2) Altfel, retry simplu cu cache-busting.
          if (typeof src === "string") setResolved(bustCache(src, attempt + 1));
        })();
      }, retryDelay(attempt));
    },
    [bucket, path, src, fallbackSrc, onError],
  );

  if (failed && !fallbackSrc) {
    return (
      <span
        aria-hidden="true"
        className={`block bg-muted ${rest.className ?? ""}`}
        style={rest.style}
      />
    );
  }

  return (
    <img loading="lazy" decoding="async" {...rest} src={resolved} onError={handleError} />
  );
}
