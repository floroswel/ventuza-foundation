import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Globe2, Loader2, MapPin, Plane, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { searchCities, type City } from "@/lib/cities";
import { isHostileCountry } from "@/lib/hostile-countries";
import {
  clearTravelLocation,
  formatRemaining,
  setTravelLocation,
  type TravelStatus,
} from "@/lib/travel";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  status: TravelStatus;
  onChanged: () => void | Promise<void>;
};

type RiskRow = { risk_level?: string | null; reason?: string | null } | null;

/**
 * Selector de locație pentru modul Explorer.
 *  - precizie de oraș (lista locală din `src/lib/cities.ts`), niciodată adresă;
 *  - avertisment de risc ÎNAINTE de confirmare, refolosind lista comună de țări
 *    ostile + RPC-ul existent `get_country_risk`;
 *  - modul expiră automat în maximum 24h (impus în DB).
 */
export function LocationPickerSheet({ open, onClose, status, onChanged }: Props) {
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<City | null>(null);
  const [risk, setRisk] = useState<RiskRow>(null);
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => searchCities(q), [q]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setPending(null);
      setRisk(null);
    }
  }, [open]);

  useEffect(() => {
    let alive = true;
    if (!pending) return;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_country_risk", { _country_code: pending.cc });
        if (!alive) return;
        setRisk(Array.isArray(data) && data.length ? (data[0] as RiskRow) : null);
      } catch {
        /* avertismentul din lista locală rămâne valabil */
      }
    })();
    return () => {
      alive = false;
    };
  }, [pending]);

  if (!open) return null;

  const hostile = pending ? isHostileCountry(pending.cc) : false;
  const riskyLevel = risk?.risk_level && risk.risk_level !== "normal";

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await setTravelLocation(pending);
      toast.success(`Explorezi din ${pending.name}. Expiră în 24 h.`);
      await onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nu am putut seta locația.");
    } finally {
      setBusy(false);
    }
  }

  async function backToReal() {
    setBusy(true);
    try {
      await clearTravelLocation();
      toast.success("Ai revenit la locația ta reală.");
      await onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nu am putut reveni la locația ta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button
        aria-label="Închide"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Alege locația"
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-surface pb-[var(--safe-bottom)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Globe2 className="size-4 shrink-0 text-primary" />
            <h2 className="truncate font-display text-lg">Mod Explorer</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {status && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
            <Plane className="size-4 shrink-0" />
            <p className="flex-1">
              Ești setat în <strong>{status.city}</strong> — mai {formatRemaining(status.until)}.
            </p>
            <button
              onClick={backToReal}
              disabled={busy}
              className="shrink-0 rounded-full border border-primary/50 px-2 py-1 font-semibold disabled:opacity-50"
            >
              Înapoi la locația mea
            </button>
          </div>
        )}

        {pending ? (
          <div className="space-y-4 p-4">
            <div className="rounded-2xl border border-border bg-surface-elevated p-3">
              <p className="text-sm font-semibold">
                {pending.name}, {pending.country}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Precizie la nivel de oraș. Oamenii de acolo te vor vedea, cu insigna „Explorer”, iar
                distanțele afișate sunt aproximative. Modul expiră automat după 24 de ore.
              </p>
            </div>

            {(hostile || riskyLevel) && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-500/50 bg-amber-950/60 p-3 text-amber-50">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
                <div className="text-xs leading-relaxed">
                  <p className="text-sm font-medium">Atenție — {pending.country}</p>
                  <p className="mt-1 text-amber-100/90">
                    {hostile
                      ? "În această țară relațiile same-sex pot fi criminalizate. Profilul tău devine vizibil pentru utilizatorii de acolo."
                      : (risk?.reason ??
                        "Regiune cu risc ridicat pentru comunitatea LGBTQ+.")}{" "}
                    Poți renunța acum sau poți continua cu prudență (recomandat: mod incognito și
                    fără date identificabile în profil).
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setPending(null)}
                disabled={busy}
                className="h-11 flex-1 rounded-full border border-border text-sm font-semibold disabled:opacity-50"
              >
                Renunț
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Explorează aici
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Caută oraș sau țară"
                  aria-label="Caută oraș sau țară"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Alegi o zonă, nu o adresă. Locația ta reală rămâne salvată separat și te poți
                întoarce la ea oricând.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
              {results.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Niciun oraș găsit pentru „{q}”.
                </p>
              ) : (
                results.map((c) => (
                  <button
                    key={`${c.cc}-${c.name}`}
                    onClick={() => setPending(c)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-elevated"
                  >
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.country}
                      </span>
                    </span>
                    {isHostileCountry(c.cc) && (
                      <AlertTriangle
                        aria-label="Țară cu risc"
                        className={cn("size-4 shrink-0 text-amber-400")}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
