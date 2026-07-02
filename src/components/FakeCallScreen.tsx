import { useEffect, useState } from "react";
import { PhoneIncoming, PhoneOff } from "lucide-react";

/**
 * Simulates an incoming phone call. Useful as a fake-emergency exit during
 * an uncomfortable in-person meeting. Auto-vibrates and plays ring on open.
 */
export function FakeCallScreen({
  onClose,
  callerName = "Mama",
}: {
  onClose: () => void;
  callerName?: string;
}) {
  const [accepted, setAccepted] = useState(false);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([400, 200, 400, 200, 400]);
    }
  }, []);

  useEffect(() => {
    if (!accepted) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [accepted]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-white">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="size-32 rounded-full bg-white/10 flex items-center justify-center text-4xl ring-4 ring-white/20">
          {callerName.charAt(0)}
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">
          {accepted ? "În apel" : "Apel intrare"}
        </p>
        <h1 className="text-3xl font-light">{callerName}</h1>
        <p className="text-sm text-white/50">{accepted ? `${mm}:${ss}` : "mobil"}</p>
      </div>
      <div className="pb-12 px-12 flex items-center justify-around">
        {!accepted ? (
          <>
            <button
              onClick={onClose}
              className="flex flex-col items-center gap-2"
              aria-label="Respinge"
            >
              <span className="size-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                <PhoneOff className="size-7" />
              </span>
              <span className="text-xs text-white/70">Respinge</span>
            </button>
            <button
              onClick={() => setAccepted(true)}
              className="flex flex-col items-center gap-2 animate-pulse"
              aria-label="Răspunde"
            >
              <span className="size-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                <PhoneIncoming className="size-7" />
              </span>
              <span className="text-xs text-white/70">Răspunde</span>
            </button>
          </>
        ) : (
          <button
            onClick={onClose}
            className="flex flex-col items-center gap-2 mx-auto"
            aria-label="Închide"
          >
            <span className="size-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <PhoneOff className="size-7" />
            </span>
            <span className="text-xs text-white/70">Închide</span>
          </button>
        )}
      </div>
    </div>
  );
}
