// <img> wrapper care detectează URL-uri HEIC/HEIF și le convertește la JPEG
// client-side (fallback pentru poze urcate înainte de fix-ul upload-ului).
// Comportament identic cu <img> altfel.
import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { convertHeicUrl, isHeicUrl } from "@/lib/heic-fallback";

export function SmartImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const { src, ...rest } = props;
  const [resolved, setResolved] = useState<string | undefined>(
    typeof src === "string" && isHeicUrl(src) ? undefined : (src as string | undefined),
  );

  useEffect(() => {
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

  return <img loading="lazy" decoding="async" {...rest} src={resolved} />;
}
