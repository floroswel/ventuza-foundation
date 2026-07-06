import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { CornerUpLeft } from "lucide-react";
import { useCallback, type ReactNode } from "react";

const SWIPE_THRESHOLD_PX = 60;

/**
 * Wraps a chat message with a swipe-right-to-reply gesture.
 * - Detects horizontal drag > 60px to the right → triggers onReply.
 * - Shows an animated reply icon that fades/scales in as the user drags.
 * - Springs back on release.
 * - Works for both incoming and outgoing messages.
 */
export function SwipeToReply({
  children,
  onReply,
  disabled,
  align = "left",
}: {
  children: ReactNode;
  onReply: () => void;
  disabled?: boolean;
  /**
   * Align controls which side the reply hint bubble appears on. For incoming
   * (`align="left"`) it renders on the left; for outgoing (`align="right"`)
   * we still surface it on the left because swipe direction is the same.
   */
  align?: "left" | "right";
}) {
  const x = useMotionValue(0);
  // Only interpret rightward drag; clamp cosmetic offset.
  const iconOpacity = useTransform(x, [0, 30, SWIPE_THRESHOLD_PX], [0, 0.6, 1]);
  const iconScale = useTransform(x, [0, SWIPE_THRESHOLD_PX], [0.6, 1.15]);

  const handleDragEnd = useCallback(
    (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const shouldFire = info.offset.x > SWIPE_THRESHOLD_PX;
      const controls = animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
      void controls;
      if (shouldFire && !disabled) {
        // Bounce feedback via a quick x pulse.
        animate(x, [SWIPE_THRESHOLD_PX + 12, 0], {
          duration: 0.28,
          ease: "easeOut",
        });
        onReply();
      }
    },
    [x, disabled, onReply],
  );

  if (disabled) return <>{children}</>;

  return (
    <div className="relative">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2"
        style={{ opacity: iconOpacity, scale: iconScale }}
      >
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-primary shadow-sm">
          <CornerUpLeft className="size-3.5" />
        </div>
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 90 }}
        dragElastic={{ left: 0, right: 0.4 }}
        onDragEnd={handleDragEnd}
        style={{ x, touchAction: "pan-y" }}
        // Small style-only nudge so nested onClick handlers keep working.
        className={align === "right" ? "" : ""}
      >
        {children}
      </motion.div>
    </div>
  );
}
