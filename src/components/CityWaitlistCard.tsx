/**
 * Waitlist pe oraș: când grila e goală, golul devine anticipare, nu dezamăgire.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cityWaitlistCount, joinCityWaitlist } from "@/lib/growth";

const TARGET = 300;

export function CityWaitlistCard({ defaultCity }: { defaultCity?: string | null }) {
  const [city, setCity] = useState(defaultCity ?? "");
  const [count, setCount] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = (defaultCity ?? "").trim();
    if (!c) return;
    void cityWaitlistCount(c).then(setCount);
  }, [defaultCity]);

  const submit = async () => {
    const c = city.trim();
    if (c.length < 2) {
      toast.error("Scrie numele orașului");
      return;
    }
    setBusy(true);
    try {
      const n = await joinCityWaitlist(c);
      setCount(n);
      setJoined(true);
      toast.success("Te-am trecut pe listă", {
        description: "Te anunțăm când zona ta se umple.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nu am putut salva");
    } finally {
      setBusy(false);
    }
  };

  const remaining = count != null ? Math.max(0, TARGET - count) : null;

  return (
    <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-border bg-surface p-4 text-left">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MapPinned className="size-4 text-primary" /> Deschidem orașul tău
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {remaining != null && count != null
          ? remaining > 0
            ? `${count} persoane s-au înscris deja aici. Mai sunt ${remaining} până când zona devine activă.`
            : `${count} persoane înscrise — zona ta e gata să pornească.`
          : "Lasă-ne orașul tău și te anunțăm imediat ce sunt destui oameni activi în zonă."}
      </p>
      {!joined && (
        <div className="mt-3 flex gap-2">
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Orașul tău"
            maxLength={80}
            className="h-9"
          />
          <Button size="sm" variant="hero" disabled={busy} onClick={submit}>
            Anunță-mă
          </Button>
        </div>
      )}
    </div>
  );
}
