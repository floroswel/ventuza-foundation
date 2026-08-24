/**
 * Mod debug pentru tracking-ul de instalări: `?debug=funnel` (sau
 * localStorage `suzeta.debug.funnel = "1"`).
 *
 * Afișează în UI referrer-ul/UTM-ul efectiv trimis către magazin, varianta A/B
 * alocată și ID-ul evenimentului salvat, ca să putem valida rapid pe Android
 * dacă atribuirea funcționează. Nu afișează nimic sensibil.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getLastFunnelEvent,
  onFunnelEvent,
  platformLabel,
  type LastFunnelEvent,
} from "@/lib/store-analytics";
import { getInstallCtaVariant } from "@/lib/install-ab-test";
import { storeReferrer, storeUrlForPlatform } from "@/lib/store-links";

const FLAG = "suzeta.debug.funnel";

export function isFunnelDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("debug");
    if (q === "funnel") {
      window.localStorage.setItem(FLAG, "1");
      return true;
    }
    if (q === "off") window.localStorage.removeItem(FLAG);
    return window.localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function FunnelDebugOverlay() {
  const [on, setOn] = useState(false);
  const [ev, setEv] = useState<LastFunnelEvent | null>(null);

  useEffect(() => {
    setOn(isFunnelDebugEnabled());
    setEv(getLastFunnelEvent());
    return onFunnelEvent(setEv);
  }, []);

  if (!on) return null;

  const variant = getInstallCtaVariant();
  const rows: Array<[string, string]> = [
    ["platformă", platformLabel()],
    ["variantă A/B", variant],
    ["referrer trimis", ev?.referrer ?? storeReferrer("hero_cta")],
    ["ultim eveniment", ev ? ev.kind : "—"],
    ["sursă", ev?.source ?? "—"],
    ["ID eveniment", ev?.id != null ? String(ev.id) : ev?.error ? "eșuat" : "—"],
    ["eroare", ev?.error ?? "—"],
    ["URL magazin", storeUrlForPlatform(ev?.source ?? "hero_cta")],
  ];

  return (
    <div className="fixed left-2 top-2 z-[9999] max-w-[92vw] rounded-xl border border-primary/40 bg-background/95 p-3 font-mono text-[11px] shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-semibold uppercase tracking-wider text-primary">
          debug · funnel instalări
        </span>
        <button
          type="button"
          aria-label="Închide debug"
          onClick={() => {
            try {
              window.localStorage.removeItem(FLAG);
            } catch {
              /* ignore */
            }
            setOn(false);
          }}
          className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted/40"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">{k}:</dt>
            <dd className="min-w-0 break-all text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
