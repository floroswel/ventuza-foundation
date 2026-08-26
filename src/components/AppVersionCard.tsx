/**
 * Card de diagnostic al versiunii: arată build-ul instalat vs. build-ul publicat
 * (`https://suzeta.app/app-version.json`), motivul EXACT pentru care bannerul de
 * actualizare apare sau nu, și dă link direct spre Google Play.
 *
 * Butonul „Verifică update” forțează o verificare imediată și cere bannerului
 * să se reafișeze (ignoră dismiss-ul și holdback-ul de rollout), ca să poți
 * testa fluxul fără să aștepți următoarea verificare periodică (6h).
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Download, BellRing, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION, APP_VERSION_CODE, detectPlatform } from "@/lib/app-version";
import {
  checkForAppUpdateDetailed,
  explainUpdateReason,
  requestUpdateCheck,
  resetUpdateDismiss,
  type UpdateDiagnostics,
} from "@/lib/app-update";
import { PLAY_STORE_URL } from "@/lib/store-links";

export function AppVersionCard() {
  const [diag, setDiag] = useState<UpdateDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setDiag(await checkForAppUpdateDetailed({ force }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const platform = detectPlatform();
  const isNative = platform === "android" || platform === "ios";
  const behind = !!diag?.remoteVersionCode && diag.remoteVersionCode > APP_VERSION_CODE;
  const error = diag?.reason === "fetch_failed" || diag?.reason === "bad_payload";

  async function testBanner() {
    resetUpdateDismiss();
    await load(true);
    requestUpdateCheck(true);
  }

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
              <span className="text-destructive">indisponibil ({diag?.error ?? "eroare"})</span>
            ) : diag?.remoteVersionCode ? (
              <>
                <span className="font-mono">v{diag.remoteVersionName}</span> (build{" "}
                {diag.remoteVersionCode})
                {typeof diag.rolloutPercent === "number" && diag.rolloutPercent < 100 && (
                  <> · rollout {diag.rolloutPercent}%</>
                )}
              </>
            ) : (
              "se verifică…"
            )}
          </p>
          {diag?.update?.notes && (
            <p className="mt-1 text-[11px] text-muted-foreground">{diag.update.notes}</p>
          )}
          {diag && (
            <p
              className={`mt-1 text-[11px] ${
                diag.reason === "update_available"
                  ? "text-amber-500"
                  : diag.reason === "up_to_date"
                    ? "text-emerald-500"
                    : "text-muted-foreground"
              }`}
            >
              {explainUpdateReason(diag)}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => void load(false)} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          <span className="ml-1.5">Verifică</span>
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void testBanner()} disabled={loading}>
          <BellRing className="size-4" aria-hidden />
          <span className="ml-1.5">Verifică update (test banner)</span>
        </Button>
        {behind && (
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
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowLog((v) => !v)}
          aria-expanded={showLog}
        >
          <ChevronDown
            className={`size-4 transition-transform ${showLog ? "rotate-180" : ""}`}
            aria-hidden
          />
          <span className="ml-1.5">Log diagnostic</span>
        </Button>
      </div>

      {showLog && diag && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
          {JSON.stringify(
            {
              motiv: diag.reason,
              explicatie: explainUpdateReason(diag),
              platforma: diag.platform,
              instalat: { versionName: diag.localVersionName, versionCode: diag.localVersionCode },
              publicat: {
                versionName: diag.remoteVersionName,
                versionCode: diag.remoteVersionCode,
                rolloutPercent: diag.rolloutPercent,
              },
              rollout: { bucketDispozitiv: diag.rolloutBucket, prag: diag.rolloutPercent },
              dismissSalvat: diag.dismissedCode,
              fortat: diag.forced,
              httpStatus: diag.httpStatus,
              eroare: diag.error,
              verificatLa: diag.checkedAt,
              sursa: "https://suzeta.app/app-version.json",
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}
