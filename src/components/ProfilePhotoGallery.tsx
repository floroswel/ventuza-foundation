import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";


type Props = {
  photos: string[]; // signed URLs already resolved
  alt?: string;
  className?: string;
  /** Overlay rendered on top of the (non-fullscreen) gallery, e.g. name + meta. */
  overlay?: ReactNode;
  /** Optional close button element rendered top-right of the gallery. */
  topRight?: ReactNode;
};

const SWIPE_THRESHOLD = 60;

/**
 * Swipeable photo gallery à la Scruff / Hinge:
 *  - drag stânga/dreapta pentru a naviga între poze,
 *  - dots indicator sus,
 *  - tap = deschide fullscreen viewer (cu swipe și swipe-jos pentru close).
 */
export function ProfilePhotoGallery({ photos, alt = "", className, overlay, topRight }: Props) {
  const [idx, setIdx] = useState(0);
  const [fs, setFs] = useState(false);

  useEffect(() => { setIdx(0); }, [photos.length]);

  if (!photos.length) {
    return (
      <div className={cn("relative flex aspect-square w-full items-center justify-center bg-background text-5xl text-muted-foreground/40", className)}>
        {alt?.[0]?.toUpperCase() ?? "?"}
        {topRight && <div className="absolute right-3 top-3 z-10">{topRight}</div>}
        {overlay && <div className="absolute inset-x-0 bottom-0 z-10">{overlay}</div>}
      </div>
    );
  }

  const go = (dir: -1 | 1) => setIdx((i) => (i + dir + photos.length) % photos.length);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_THRESHOLD) go(1);
    else if (info.offset.x > SWIPE_THRESHOLD) go(-1);
  }

  return (
    <>
      <div className={cn("relative aspect-square w-full overflow-hidden bg-background select-none", className)}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={photos[idx]}
            src={photos[idx]}
            alt={alt}
            draggable={false}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={handleDragEnd}
            onClick={() => setFs(true)}
            initial={{ opacity: 0.6, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="size-full cursor-zoom-in object-cover"
          />
        </AnimatePresence>

        {/* Invisible tap zones for desktop / accessibility */}
        {photos.length > 1 && (
          <>
            <button
              aria-label="Poza anterioară"
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              className="absolute left-0 top-0 h-full w-1/4"
            />
            <button
              aria-label="Poza următoare"
              onClick={(e) => { e.stopPropagation(); go(1); }}
              className="absolute right-0 top-0 h-full w-1/4"
            />
          </>
        )}

        {/* Dots */}
        {photos.length > 1 && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 flex -translate-x-1/2 gap-1">
            {photos.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === idx ? "w-6 bg-white" : "w-3 bg-white/40",
                )}
              />
            ))}
          </div>
        )}

        {topRight && <div className="absolute right-3 top-3 z-20">{topRight}</div>}
        {overlay && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 [&_*]:pointer-events-auto">{overlay}</div>}
      </div>

      <AnimatePresence>
        {fs && (
          <FullscreenViewer
            photos={photos}
            initial={idx}
            alt={alt}
            onIndexChange={setIdx}
            onClose={() => setFs(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FullscreenViewer({
  photos, initial, alt, onClose, onIndexChange,
}: {
  photos: string[];
  initial: number;
  alt: string;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const [i, setI] = useState(initial);

  useEffect(() => { onIndexChange(i); }, [i, onIndexChange]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((v) => (v - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setI((v) => (v + 1) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 && Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      onClose();
      return;
    }
    if (info.offset.x < -SWIPE_THRESHOLD) setI((v) => (v + 1) % photos.length);
    else if (info.offset.x > SWIPE_THRESHOLD) setI((v) => (v - 1 + photos.length) % photos.length);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      <button
        onClick={onClose}
        aria-label="Închide"
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
      >
        <X className="size-5" />
      </button>

      {photos.length > 1 && (
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 gap-1">
          {photos.map((_, k) => (
            <span
              key={k}
              className={cn(
                "h-1 rounded-full transition-all",
                k === i ? "w-8 bg-white" : "w-3 bg-white/40",
              )}
            />
          ))}
        </div>
      )}

      <AnimatePresence initial={false} mode="popLayout">
        <motion.img
          key={photos[i]}
          src={photos[i]}
          alt={alt}
          draggable={false}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={{ top: 0.4, bottom: 0.4, left: 0.3, right: 0.3 }}
          onDragEnd={onDragEnd}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="max-h-[100dvh] max-w-full object-contain"
        />
      </AnimatePresence>

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-white/50">
        {i + 1} / {photos.length} · glisează jos pentru închidere
      </p>
    </motion.div>
  );
}
