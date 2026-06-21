import { useState } from "react";
import { toast } from "sonner";
import { Flame, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const INTENT_OPTIONS = ["Chat", "Coffee", "Drinks", "Hookup", "Dates", "Right now"] as const;
const DURATION_OPTIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
] as const;

export function RightNowCard({
  userId,
  lookingNowUntil,
  lookingNowIntent,
  onUpdate,
}: {
  userId: string;
  lookingNowUntil: string | null;
  lookingNowIntent: string | null;
  onUpdate: () => void;
}) {
  const active = !!lookingNowUntil && new Date(lookingNowUntil) > new Date();
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<string>(lookingNowIntent ?? "Right now");
  const minutesLeft = active
    ? Math.max(0, Math.round((new Date(lookingNowUntil!).getTime() - Date.now()) / 60_000))
    : 0;

  async function activate(minutes: number) {
    setBusy(true);
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ looking_now_until: until, looking_now_intent: intent })
      .eq("id", userId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Right Now activ ${minutes} min — apari pe Cruise ✨`);
      onUpdate();
    }
  }

  async function stop() {
    setBusy(true);
    await supabase
      .from("profiles")
      .update({ looking_now_until: null, looking_now_intent: null })
      .eq("id", userId);
    setBusy(false);
    toast.success("Right Now dezactivat");
    onUpdate();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            active ? "bg-rose-500/15 text-rose-400" : "bg-surface-elevated text-muted-foreground"
          }`}
        >
          <Flame className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Right Now</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {active
              ? `Activ încă ${minutesLeft} min · ${lookingNowIntent ?? "Right now"}`
              : "Spune-le că ești disponibil acum. Apari pe harta Cruise."}
          </p>
        </div>
      </div>

      {!active && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {INTENT_OPTIONS.map((o) => (
              <button
                key={o}
                onClick={() => setIntent(o)}
                className={
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors " +
                  (intent === o
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                {o}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d.minutes}
                onClick={() => activate(d.minutes)}
                disabled={busy}
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground glow-gold disabled:opacity-60"
              >
                {busy ? <Loader2 className="mx-auto size-3 animate-spin" /> : d.label}
              </button>
            ))}
          </div>
        </>
      )}

      {active && (
        <button
          onClick={stop}
          disabled={busy}
          className="mt-3 w-full rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Oprește acum
        </button>
      )}
    </div>
  );
}
