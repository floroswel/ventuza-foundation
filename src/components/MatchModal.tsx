import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function SendFirstMessageButton({ onSend }: { onSend: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="hero"
      size="lg"
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try { await onSend(); } finally { setBusy(false); }
      }}
    >
      {busy ? <><Loader2 className="size-4 animate-spin mr-2" /> Se deschide…</> : "Trimite primul mesaj"}
    </Button>
  );
}

const GOLD_PALETTE = ["#E8C66B", "#F2D98D", "#C9A24A", "#FFFFFF", "#B8860B"];

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch { /* noop */ }
}

export function MatchModal({
  open, onClose, otherName, otherPhotoUrl, onSendFirstMessage,
}: {
  open: boolean;
  onClose: () => void;
  otherName: string;
  otherPhotoUrl: string | null;
  /** Optional CTA. If provided, modal shows "Trimite primul mesaj" button. */
  onSendFirstMessage?: () => void | Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    if (!open) { setPhase(0); return; }

    // Haptic chord — 3 escalating taps
    vibrate([40, 60, 60, 60, 90]);

    // Canvas-confetti golden burst from sides + center pop
    const colors = GOLD_PALETTE;
    confetti({ particleCount: 80, spread: 90, startVelocity: 45, origin: { y: 0.5 }, colors, scalar: 1.1 });
    const end = Date.now() + 1800;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();

    // Phase progression for ceremony text
    const t1 = setTimeout(() => { setPhase(1); vibrate(30); }, 300);
    const t2 = setTimeout(() => { setPhase(2); vibrate(30); }, 900);
    const t3 = setTimeout(() => setPhase(3), 1500);

    // Custom gold particle layer on canvas (drifting embers)
    const cv = canvasRef.current;
    if (cv) {
      const ctx = cv.getContext("2d");
      cv.width = cv.clientWidth * devicePixelRatio;
      cv.height = cv.clientHeight * devicePixelRatio;
      const particles = Array.from({ length: 60 }, () => ({
        x: Math.random() * cv.width,
        y: cv.height + Math.random() * 100,
        r: Math.random() * 2.5 + 1,
        vy: -(Math.random() * 0.8 + 0.3),
        vx: (Math.random() - 0.5) * 0.4,
        a: Math.random() * 0.6 + 0.3,
      }));
      let raf = 0;
      const tick = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, cv.width, cv.height);
        for (const p of particles) {
          p.y += p.vy * devicePixelRatio;
          p.x += p.vx * devicePixelRatio;
          if (p.y < -10) { p.y = cv.height + 10; p.x = Math.random() * cv.width; }
          ctx.beginPath();
          ctx.fillStyle = `rgba(232, 198, 107, ${p.a})`;
          ctx.shadowColor = "#E8C66B";
          ctx.shadowBlur = 8;
          ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
          ctx.fill();
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
      return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-xl"
        >
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />

          <motion.div
            initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-primary/40 bg-surface/90 p-8 text-center glow-gold backdrop-blur"
          >
            <div className="pride-bar absolute inset-x-0 top-0 h-1" />

            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.4em] text-primary"
            >
              <Sparkles className="size-3" /> A new connection <Sparkles className="size-3" />
            </motion.div>

            <motion.h2
              initial={{ scale: 0.7, opacity: 0 }}
              animate={phase >= 1 ? { scale: 1, opacity: 1 } : {}}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
              className="wordmark mt-4 text-5xl font-medium"
            >
              It's a match.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }} animate={phase >= 2 ? { opacity: 1 } : {}}
              className="mt-2 text-muted-foreground"
            >
              You and <span className="text-foreground">{otherName}</span> liked each other.
            </motion.p>

            {otherPhotoUrl && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                animate={phase >= 2 ? { scale: 1, opacity: 1, rotate: 0 } : {}}
                transition={{ type: "spring", stiffness: 200, damping: 16 }}
                className="mx-auto mt-6 size-32 overflow-hidden rounded-full border-2 border-primary glow-gold"
              >
                <img src={otherPhotoUrl} alt={otherName} className="size-full object-cover" />
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
              className="mt-8 flex flex-col gap-2"
            >
              {onSendFirstMessage && (
                <SendFirstMessageButton onSend={onSendFirstMessage} />
              )}
              <Button
                variant={onSendFirstMessage ? "outline" : "hero"}
                size="lg"
                onClick={onClose}
              >
                Keep discovering
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
