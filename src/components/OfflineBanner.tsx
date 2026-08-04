import { useEffect, useState } from "react";
import { WifiOff, X } from "lucide-react";

/**
 * Discret, dismissable "You're offline — viewing saved content" banner.
 * Reappears when the browser reports offline again after being dismissed once online.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const update = () => {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      if (isOnline) setDismissed(false); // reset on reconnect
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online || dismissed) return null;
  return (
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.5rem,var(--safe-top))]">
      <div className="flex max-w-md items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100 shadow-lg backdrop-blur">
        <WifiOff className="size-3.5 shrink-0" />
        <span className="flex-1">Ești offline — vezi conținut salvat</span>
        <button
          type="button"
          aria-label="Închide"
          onClick={() => setDismissed(true)}
          className="rounded-full p-0.5 hover:bg-amber-500/25"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
