import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  INSTALL_DISMISSED_KEY,
  PLAY_STORE_URL,
  shouldShowInstallBanner,
} from "@/lib/app-store-link";
import { SUZETA_ICON_URL } from "@/lib/brand-assets";

/**
 * Invitație către aplicația din Google Play, pentru vizitatorii de pe Android.
 *
 * Nu apare în aplicația nativă și se poate închide definitiv. Se montează abia
 * după `useEffect`, deci nu există la randarea pe server — altfel ar clipi pe
 * ecranele unde nu are ce căuta.
 */
export function GetTheAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let isNative = false;
      try {
        const { Capacitor } = await import("@capacitor/core");
        isNative = Capacitor.isNativePlatform();
      } catch {
        /* pe web pluginul poate lipsi — rămâne false */
      }
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
      } catch {
        /* localStorage blocat (mod privat) — arătăm bannerul */
      }
      if (cancelled) return;
      setShow(
        shouldShowInstallBanner({
          isNative,
          userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
          dismissed,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch {
      /* nu putem ține minte — reapare data viitoare, acceptabil */
    }
  }

  return (
    <div
      data-testid="get-the-app-banner"
      className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/60 bg-surface/95 px-3 py-2 backdrop-blur"
    >
      <img
        src={SUZETA_ICON_URL}
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">Suzeta pentru Android</p>
        <p className="truncate text-xs text-muted-foreground">
          Notificări, chat mai rapid, deschidere instantanee.
        </p>
      </div>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
      >
        Instalează
      </a>
      <button
        onClick={dismiss}
        aria-label="Închide"
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
