import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { hasPin, isUnlocked, verifyPin } from "@/lib/pin-lock";

/** Full-screen PIN overlay. Renders only when a PIN is set AND the session is locked. */
export function PinLockGate() {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function refresh() {
      setLocked(hasPin() && !isUnlocked());
    }
    refresh();
    const onVis = () => {
      // Re-lock when tab regains focus after being hidden > 30s.
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("vz:pin-changed", refresh as EventListener);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("vz:pin-changed", refresh as EventListener);
    };
  }, []);

  if (!locked) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await verifyPin(pin);
    if (ok) {
      setLocked(false);
      setPin("");
      setError(null);
    } else {
      setError("PIN incorect");
      setPin("");
    }
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-background/95 backdrop-blur">
      <form onSubmit={submit} className="w-full max-w-xs rounded-3xl border border-border bg-surface p-6 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <Lock className="size-5" />
        </div>
        <h2 className="text-base font-semibold">Aplicație blocată</h2>
        <p className="mt-1 text-xs text-muted-foreground">Introdu PIN-ul pentru a continua.</p>
        <input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl tracking-[0.6em] outline-none focus:border-primary"
          placeholder="••••"
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={pin.length < 4}
          className="mt-4 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Deblochează
        </button>
      </form>
    </div>
  );
}
