import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export function MatchModal({
  open, onClose, otherName, otherPhotoUrl,
}: {
  open: boolean;
  onClose: () => void;
  otherName: string;
  otherPhotoUrl: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const colors = ["#E8C66B", "#F2D98D", "#C9A24A", "#FFFFFF"];
    const end = Date.now() + 1200;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur"
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-primary/30 bg-surface p-8 text-center glow-gold"
          >
            <div className="pride-bar absolute inset-x-0 top-0 h-1" />
            <p className="text-xs uppercase tracking-[0.3em] text-primary">A new connection</p>
            <h2 className="wordmark mt-3 text-5xl font-medium">It's a match.</h2>
            <p className="mt-2 text-muted-foreground">You and {otherName} liked each other.</p>

            {otherPhotoUrl && (
              <div className="mx-auto mt-6 size-32 overflow-hidden rounded-full border-2 border-primary glow-gold">
                <img src={otherPhotoUrl} alt={otherName} className="size-full object-cover" />
              </div>
            )}

            <div className="mt-8 flex flex-col gap-2">
              <Button variant="hero" size="lg" onClick={onClose}>Keep discovering</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
