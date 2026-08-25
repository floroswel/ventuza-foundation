/**
 * Card de diagnostic al versiunii: arată build-ul instalat vs. build-ul publicat
 * (`https://suzeta.app/app-version.json`) și dă link direct spre Google Play.
 *
 * Spre deosebire de `UpdateAvailableBanner` (doar nativ), acest card
 * funcționează și pe web, ca să poți verifica oricând ce versiune a ajuns live.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION, APP_VERSION_CODE, detectPlatform } from "@/lib/app-version";
import { PLAY_STORE_URL } from "@/lib/store-links";

type Remote = { versionName: string; versionCode: number; notes?: string; updatedAt?: string };

export function AppVersionCard() {
  const [remote, setRemote] = useState<Remote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://suzeta.app/app-version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRemote((await res.json()) as Remote);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verificare eșuată");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const platform = detectPlatform();
  const isNative = platform === "android" || platform === "ios";
  const behind = !!remote && Number(remote.versionCode) > APP_VERSION_CODE;

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Versiune aplicație</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Instalat: <span className="font-mono">v{APP_VERSION}</span> (build {APP_VERSION_CODE}) ·{" "}
            {isNative ? "nativ" : "web"}
          </p>
          <p className="text-xs text-muted-foreground">
            Publicat:{" "}
            {error ? (
              <span className="text-destructive">indisponibil ({error})</span>
            ) : remote ? (
              <>
                <span className="font-mono">v{remote.versionName}</span> (build {remote.versionCode})
              </>
            ) : (
              "se verifică…"
            )}
          </p>
          {remote?.notes && (
            <p className="mt-1 text-[11px] text-muted-foreground">{remote.notes}</p>
          )}
          {remote && !behind && !error && (
            <p className="mt-1 text-[11px] text-emerald-500">Ești pe ultima versiune publicată.</p>
          )}
          {behind && (
            <p className="mt-1 text-[11px] text-amber-500">
              {isNative
                ? "Există o versiune mai nouă în Google Play."
                : "Web-ul tău e în cache — reîncarcă pagina pentru ultima versiune."}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          <span className="ml-1.5">Verifică</span>
        </Button>
      </div>

      {behind && (
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() => {
              if (isNative) window.open(PLAY_STORE_URL, "_blank", "noopener");
              else window.location.reload();
            }}
          >
            <Download className="size-4" aria-hidden />
            <span className="ml-1.5">{isNative ? "Deschide Google Play" : "Reîncarcă"}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
