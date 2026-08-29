/**
 * Safety check-in: programezi o verificare înainte de întâlnire. Dacă nu
 * confirmi la timp, primești o alertă de escaladare (cron server-side).
 * Nu stocăm locație — doar momentul verificării și o notă proprie.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlarmClock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createSafetyCheckin,
  getActiveCheckin,
  resolveSafetyCheckin,
  type SafetyCheckin,
} from "@/lib/growth";

const OPTIONS = [60, 120, 180];

export function SafetyCheckinCard() {
  const [active, setActive] = useState<SafetyCheckin | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    void getActiveCheckin().then(setActive);
  };

  useEffect(refresh, []);

  const start = async (minutes: number) => {
    setBusy(true);
    try {
      await createSafetyCheckin(minutes, note);
      toast.success("Check-in programat", {
        description: `Te întrebăm peste ${minutes / 60} h dacă ești bine.`,
      });
      setNote("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nu am putut programa");
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (status: "confirmed" | "cancelled") => {
    if (!active) return;
    setBusy(true);
    try {
      await resolveSafetyCheckin(active.id, status);
      toast.success(status === "confirmed" ? "Mă bucur că ești bine" : "Check-in anulat");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nu am putut actualiza");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlarmClock className="size-4 text-primary" /> Check-in de siguranță
      </div>

      {active ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {active.status === "escalated"
              ? "Nu ai confirmat la timp. Ești bine? Dacă ai nevoie de ajutor, sună la 112."
              : `Te întrebăm dacă ești bine la ${new Date(active.due_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}.`}
            {active.note ? ` Notă: „${active.note}”.` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="hero" disabled={busy} onClick={() => resolve("confirmed")}>
              <CheckCircle2 className="mr-1 size-4" /> Sunt bine
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve("cancelled")}>
              <XCircle className="mr-1 size-4" /> Anulează
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Mergi la o întâlnire? Programează o verificare. Dacă nu confirmi la timp, primești
            alertă cu resursele de urgență.
          </p>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notă pentru tine (opțional): unde ești, cu cine"
            maxLength={200}
            className="mt-3 h-9"
          />
          <div className="mt-2 flex gap-2">
            {OPTIONS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => start(m)}
              >
                {m / 60} h
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
