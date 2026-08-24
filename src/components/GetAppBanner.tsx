/**
 * Banner „Deschide / Descarcă aplicația” pentru vizitatorii web.
 *
 * Comportament:
 *   - dacă aplicația e DEJA instalată (getInstalledRelatedApps) → CTA
 *     „Deschide în aplicație”, care lansează intent-ul nativ;
 *   - dacă nu e instalată (sau nu putem ști) → intent cu fallback automat pe
 *     Google Play, deci un singur click acoperă ambele cazuri.
 *
 * Nu apare niciodată în wrapper-ul nativ. Dismissabil.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { isAndroidAppInstalled, isAndroidWebBrowser, openAppOrStore } from "@/lib/store-links";
import { SUZETA_ICON_URL } from "@/lib/brand-assets";

const DISMISS_KEY = "suzeta_play_banner_dismissed_v1";

export function GetAppBanner({ path = "/" }: { path?: string }) {
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAndroidWebBrowser()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocat — arătăm oricum */
    }
    setShow(true);
    let cancelled = false;
    void isAndroidAppInstalled().then((v) => {
      if (!cancelled) setInstalled(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9000] border-t border-border bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <img
          src={SUZETA_ICON_URL}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">Suzeta pentru Android</p>
          <p className="truncate text-xs text-muted-foreground">
            {installed
              ? "Ai deja aplicația — deschide-o pentru experiență completă"
              : "Aplicația oficială, gratuită, din Google Play"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAppOrStore(path)}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
        >
          {installed ? "Deschide" : "Instalează"}
        </button>
        <button
          type="button"
          aria-label="Închide"
          onClick={() => {
            setShow(false);
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
          }}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted/40"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
