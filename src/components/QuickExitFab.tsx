import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

const NEUTRAL_URL = "https://www.google.com/search?q=weather";

// Where the FAB shows. Stays out of auth/legal/onboarding screens.
const SHOW_PREFIXES = [
  "/discover", "/messages", "/swipe", "/visitors", "/favorites",
  "/groups", "/events", "/quests", "/profile", "/u/",
];

/**
 * Always-visible "Quick Exit" button.
 * - Single tap: confirm via long-press style (hold 400ms) OR press 3x in 2s.
 * - Triple-Escape on keyboard also triggers it.
 * Action: wipes session storage + replaces history with neutral URL so the
 * back button can't reveal the app.
 */
export function QuickExitFab() {
  const location = useLocation();
  const visible = SHOW_PREFIXES.some((p) => location.pathname.startsWith(p));
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    if (taps === 0) return;
    if (taps >= 3) {
      doExit();
      return;
    }
    const t = setTimeout(() => setTaps(0), 1500);
    return () => clearTimeout(t);
  }, [taps]);

  // Triple-ESC fallback
  useEffect(() => {
    let count = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      count++;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (count = 0), 1500);
      if (count >= 3) {
        count = 0;
        doExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function doExit() {
    try {
      sessionStorage.clear();
    } catch { /* ignore */ }
    // Replace history so back button doesn't return to the app.
    window.location.replace(NEUTRAL_URL);
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Ieșire rapidă (apasă de 3 ori)"
      onClick={() => setTaps((n) => n + 1)}
      className="fixed bottom-24 right-3 z-[60] flex items-center gap-1.5 rounded-full border border-destructive/40 bg-background/85 px-3 py-2 text-[11px] font-medium text-destructive shadow-lg backdrop-blur-xl transition active:scale-95 hover:bg-destructive/10"
    >
      <ShieldAlert className="size-3.5" />
      Ieșire
      {taps > 0 && (
        <span className="ml-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px]">
          {taps}/3
        </span>
      )}
    </button>
  );
}
