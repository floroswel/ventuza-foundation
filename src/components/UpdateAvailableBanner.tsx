/**
 * Banner „Actualizare disponibilă” pentru aplicația nativă.
 *
 * Apare doar dacă `app-version.json` de pe suzeta.app anunță un versionCode
 * mai mare decât cel instalat (build din Play). Butonul deschide fișa din
 * Google Play, unde userul apasă „Actualizează”.
 */
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  checkForAppUpdate,
  dismissUpdate,
  UPDATE_CHECK_EVENT,
  type RemoteVersion,
} from "@/lib/app-update";
import { PLAY_STORE_URL } from "@/lib/store-links";

const RECHECK_MS = 6 * 60 * 60 * 1000; // 6h

export function UpdateAvailableBanner() {
  const [update, setUpdate] = useState<RemoteVersion | null>(null);

  useEffect(() => {
    let alive = true;
    const run = (force = false) => {
      void checkForAppUpdate({ force }).then((u) => {
        if (alive) setUpdate(u);
      });
    };
    // Butonul „Verifică update” din Setări forțează o verificare imediată
    // (ignoră dismiss + holdback-ul de rollout) ca să poți testa bannerul.
    const onManual = (e: Event) => {
      const force = (e as CustomEvent<{ force?: boolean }>).detail?.force !== false;
      run(force);
    };
    window.addEventListener(UPDATE_CHECK_EVENT, onManual);
    // Mic delay ca să nu concureze cu boot-ul / prefetch-ul.
    const t = setTimeout(run, 4000);
    const i = setInterval(run, RECHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(UPDATE_CHECK_EVENT, onManual);
      alive = false;
      clearTimeout(t);
      clearInterval(i);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!update) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Download className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Actualizare disponibilă {update.versionName ? `(v${update.versionName})` : ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Instalează ultima versiune pentru corectări și funcții noi.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            window.open(PLAY_STORE_URL, "_blank", "noopener");
          }}
        >
          Actualizează
        </Button>
        <button
          type="button"
          aria-label="Închide"
          className="text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            dismissUpdate(update.versionCode);
            setUpdate(null);
          }}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
