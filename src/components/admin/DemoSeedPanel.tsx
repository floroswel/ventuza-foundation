/**
 * Admin — Demo Seed panel + production warning banner.
 *
 * Buton:
 *  - "Populează conținut demo" → seedDemoContent (super_admin)
 *  - "Șterge tot conținutul demo" → deleteDemoContent (super_admin)
 *  - "Simulează locația mea" (super_admin only, ascuns în producție)
 *
 * Plus avertizare vizibilă "ATENȚIE: ai conținut demo în producție" dacă
 * `seed_content_summary` întoarce orice >0 pe un host de producție.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, MapPin, AlertOctagon } from "lucide-react";
import {
  seedDemoContent,
  deleteDemoContent,
  getSeedSummary,
  simulateProximity,
} from "@/lib/demo-seed.functions";
import { isProductionHost } from "@/lib/age-gate-policy";

type Summary = {
  partners?: number;
  venues?: number;
  events?: number;
  offers?: number;
  ads?: number;
  subs?: number;
};

export function DemoSeedBanner() {
  const [hasSeed, setHasSeed] = useState(false);
  const fetchSummary = useServerFn(getSeedSummary);
  useEffect(() => {
    fetchSummary()
      .then((s: Summary) => {
        const total =
          (s.partners ?? 0) +
          (s.venues ?? 0) +
          (s.events ?? 0) +
          (s.offers ?? 0) +
          (s.ads ?? 0) +
          (s.subs ?? 0);
        setHasSeed(total > 0);
      })
      .catch(() => {});
  }, [fetchSummary]);
  if (!hasSeed || !isProductionHost()) return null;
  return (
    <div className="border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-center text-xs font-medium text-red-300">
      <AlertOctagon className="mr-1 inline size-3.5" />
      <b>ATENȚIE:</b> ai conținut demo (<code>is_seed=true</code>) în <b>PRODUCȚIE</b>. Șterge-l din
      Admin → <b>Demo seed</b> → "Șterge tot conținutul demo".
    </div>
  );
}

export function DemoSeedPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const seed = useServerFn(seedDemoContent);
  const wipe = useServerFn(deleteDemoContent);
  const summary = useServerFn(getSeedSummary);
  const sim = useServerFn(simulateProximity);

  const [s, setS] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [simLat, setSimLat] = useState("44.4378");
  const [simLng, setSimLng] = useState("26.0974");
  const [simRadius, setSimRadius] = useState("2000");
  const [simRes, setSimRes] = useState<any | null>(null);

  const refresh = () =>
    summary()
      .then(setS)
      .catch((e: any) => toast.error(e.message));
  useEffect(() => {
    void refresh(); /* eslint-disable-next-line */
  }, []);

  if (!isSuperAdmin) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
        Necesită rol <b>super_admin</b>.
      </div>
    );
  }

  const onSeed = async () => {
    if (
      !confirm(
        "Populez conținut demo (parteneri/venues/events/offers + ads)?\nTotul va fi marcat is_seed=true.",
      )
    )
      return;
    setBusy("seed");
    try {
      const r = await seed();
      toast.success(`Demo populat: ${r.log.join(" · ")}`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  const onWipe = async () => {
    if (!confirm("ȘTERG TOT conținutul demo (is_seed=true)? Acțiunea nu poate fi anulată.")) return;
    setBusy("wipe");
    try {
      const r = await wipe();
      toast.success(`Demo șters · ${r.deletedUsers} useri auth`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  const onSim = async () => {
    setBusy("sim");
    try {
      const r = await sim({
        data: {
          lat: parseFloat(simLat),
          lng: parseFloat(simLng),
          radiusM: parseInt(simRadius, 10),
        },
      });
      setSimRes(r);
      toast.success(`Bucket ${r.bucketId} · ${r.count} puncte`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const totals = s
    ? Object.entries(s)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")
    : "…";
  const inProd = isProductionHost();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> Conținut demo (is_seed)
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Sumar curent: <code>{totals}</code>
        </p>
        {inProd && (
          <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-300">
            <AlertOctagon className="mr-1 inline size-3" />
            <b>Producție:</b> „Populează conținut demo” este dezactivat. Folosește doar pe dev/preview.
            „Șterge tot conținutul demo” rămâne activ pentru curățare urgentă.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onSeed}
            disabled={busy !== null || inProd}
            title={inProd ? "Dezactivat în producție" : undefined}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy === "seed" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Populează conținut demo
          </button>
          <button
            onClick={onWipe}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-md border border-red-500/50 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {busy === "wipe" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Șterge tot conținutul demo
          </button>
          <button onClick={refresh} className="rounded-md border border-border px-3 py-2 text-xs">
            Reîmprospătează
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Tot ce generăm intră prin fluxul real (RLS + moderare aprobată ca staff) și apare în
          Nearby/Hartă/Notificări exact ca datele reale. Marcajul <code>is_seed</code> e singurul
          lucru care le distinge — îl folosim doar pentru ștergere rapidă și pentru avertizarea de
          producție.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 text-primary" /> Simulează locația mea{" "}
          {inProd && (
            <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">
              dezactivat în prod
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Trimite lat/lng direct în RPC-urile reale <code>nearby_points</code> +{" "}
          <code>try_record_proximity_hit</code>. Vezi ce ar declanșa fără să te plimbi.
        </p>
        {inProd ? (
          <p className="mt-2 text-xs text-red-300">Simulatorul rulează doar pe dev/preview.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="text-[11px] text-muted-foreground">
                lat
                <input
                  value={simLat}
                  onChange={(e) => setSimLat(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                lng
                <input
                  value={simLng}
                  onChange={(e) => setSimLng(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                raza (m)
                <input
                  value={simRadius}
                  onChange={(e) => setSimRadius(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["București", 44.4378, 26.0974],
                ["Cluj", 46.7712, 23.6236],
                ["Timișoara", 45.7489, 21.2087],
                ["Iași", 47.1585, 27.6014],
                ["Constanța", 44.1598, 28.6348],
              ].map(([n, la, ln]: any) => (
                <button
                  key={n}
                  onClick={() => {
                    setSimLat(String(la));
                    setSimLng(String(ln));
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-background"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={onSim}
                disabled={busy !== null}
                className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy === "sim" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <MapPin className="size-3.5" />
                )}
                Rulează
              </button>
            </div>
            {simRes && (
              <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 text-xs">
                <div className="text-muted-foreground">
                  bucket: <code>{simRes.bucketId}</code> · {simRes.count} puncte
                </div>
                <ul className="mt-2 space-y-1">
                  {simRes.results.map((r: any) => (
                    <li key={`${r.kind}:${r.id}`} className="flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                        {r.kind}
                      </span>
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-muted-foreground">{r.distance_m}m</span>
                      {r.gate && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${r.gate.allowed ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}
                        >
                          {r.gate.allowed ? "✓ allowed" : `✗ ${r.gate.reason}`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
