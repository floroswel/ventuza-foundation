import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Image with anti-screenshot/anti-save protections + reciprocal blur.
 * - Disables right-click, drag, long-press save and selection.
 * - Auto-blurs when the tab loses focus (defeats most casual screen capture flows).
 * - Tap-to-reveal: starts blurred, user must hold/tap to view.
 * - Optional diagonal watermark (viewer hint) to discourage redistribution.
 */
export function ProtectedImage({
  src,
  alt = "",
  watermark,
  className = "",
  startBlurred = true,
}: {
  src: string;
  alt?: string;
  watermark?: string;
  className?: string;
  startBlurred?: boolean;
}) {
  const [revealed, setRevealed] = useState(!startBlurred);
  const [hidden, setHidden] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const blurred = hidden || !revealed;

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden select-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="size-full object-cover pointer-events-none transition-[filter] duration-200"
        style={{ filter: blurred ? "blur(28px) brightness(0.7)" : "none" }}
      />
      {/* Transparent overlay blocks long-press save on iOS/Android */}
      <div className="absolute inset-0" />
      {watermark && !blurred && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-22deg] text-[10px] font-semibold tracking-widest text-white/40 mix-blend-overlay">
            {watermark}
          </span>
        </div>
      )}
      {blurred && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30 text-white text-[10px] font-medium"
        >
          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {hidden ? "Ascuns" : "Atinge pentru a vedea"}
        </button>
      )}
    </div>
  );
}
