import { useEffect, useRef } from "react";

/**
 * Auto-logout after `minutes` of user inactivity. Calls `onTimeout`.
 * Resets on mouse, keyboard, touch, scroll, visibility change.
 */
export function useIdleLogout(minutes: number, onTimeout: () => void, enabled = true) {
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(onTimeout, minutes * 60 * 1000);
    };
    const events = ["mousemove", "keydown", "touchstart", "scroll", "click", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes, onTimeout, enabled]);
}
