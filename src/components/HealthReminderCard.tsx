import { useEffect, useState } from "react";
import { Heart, Calendar, Bell, Check } from "lucide-react";

/**
 * Local-only reminders for HIV/STI testing and PrEP refills.
 * Stored in localStorage — keeps health data off-server by default.
 */
type Reminder = {
  hivTestDate: string | null;
  prepRefillDate: string | null;
  enabled: boolean;
};

const KEY = "vz_health_reminders";

function load(): Reminder {
  if (typeof window === "undefined") return { hivTestDate: null, prepRefillDate: null, enabled: false };
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "") as Reminder;
  } catch {
    return { hivTestDate: null, prepRefillDate: null, enabled: false };
  }
}

function save(r: Reminder) {
  localStorage.setItem(KEY, JSON.stringify(r));
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export function HealthReminderCard() {
  const [r, setR] = useState<Reminder>({ hivTestDate: null, prepRefillDate: null, enabled: false });

  useEffect(() => {
    setR(load());
  }, []);

  function update(patch: Partial<Reminder>) {
    const next = { ...r, ...patch };
    setR(next);
    save(next);
  }

  const hivDays = daysUntil(r.hivTestDate);
  const prepDays = daysUntil(r.prepRefillDate);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Heart className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Reminders sănătate</h2>
        <button
          onClick={() => update({ enabled: !r.enabled })}
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${r.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          {r.enabled ? <Check className="size-3" /> : <Bell className="size-3" />}
          {r.enabled ? "Active" : "Off"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Stocate local pe device-ul tău. Nu părăsesc telefonul.
      </p>

      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Următor test HIV / ITS</span>
          <div className="mt-1 flex items-center gap-2">
            <Calendar className="size-3.5 text-muted-foreground" />
            <input
              type="date"
              value={r.hivTestDate ?? ""}
              onChange={(e) => update({ hivTestDate: e.target.value || null })}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
            />
          </div>
          {hivDays !== null && (
            <p className={`mt-1 text-[11px] ${hivDays < 0 ? "text-destructive" : hivDays < 7 ? "text-primary" : "text-muted-foreground"}`}>
              {hivDays < 0 ? `Restant cu ${Math.abs(hivDays)} zile` : hivDays === 0 ? "Azi" : `În ${hivDays} zile`}
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">Următoare doză PrEP / PEP</span>
          <div className="mt-1 flex items-center gap-2">
            <Calendar className="size-3.5 text-muted-foreground" />
            <input
              type="date"
              value={r.prepRefillDate ?? ""}
              onChange={(e) => update({ prepRefillDate: e.target.value || null })}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
            />
          </div>
          {prepDays !== null && (
            <p className={`mt-1 text-[11px] ${prepDays < 0 ? "text-destructive" : prepDays < 3 ? "text-primary" : "text-muted-foreground"}`}>
              {prepDays < 0 ? `Restant cu ${Math.abs(prepDays)} zile` : prepDays === 0 ? "Azi" : `În ${prepDays} zile`}
            </p>
          )}
        </label>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Recomandare: test HIV la fiecare 3 luni dacă ești sexual activ.
      </p>
    </div>
  );
}
