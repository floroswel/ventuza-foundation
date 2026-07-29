/**
 * VersionGate — enforcement client-side pentru `app_settings.min_supported_version`.
 * Dacă versiunea instalată e sub minimul configurat pentru platformă, afișează
 * un blocker full-screen cu CTA către App Store / Play / reload.
 *
 * Sursa de adevăr rămâne DB (`app_settings.min_supported_version`), setată
 * exclusiv prin `admin_update_setting` (audit + versionare). Client-ul doar
 * blochează UI; nu poate ocoli gate-urile server (`assert_account_usable`,
 * `has_active_consent`, etc.).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, detectPlatform, isBelowMinVersion } from "@/lib/app-version";

type MinVersion = {
  web?: string;
  ios?: string;
  android?: string;
  force_update_message?: string;
};

const STORE_URL: Record<"ios" | "android", string> = {
  ios: "https://apps.apple.com/",
  android: "https://play.google.com/store/apps/details?id=app.suzeta",
};

export function VersionGate() {
  const [min, setMin] = useState<MinVersion | null>(null);
  const platform = detectPlatform();

  useEffect(() => {
    let cancelled = false;
    // Citim public — dacă rândul nu e vizibil pentru rolul curent, gate-ul
    // pur și simplu nu blochează (fail-open pentru anon). Nu e regresie:
    // producția are enforcement server-side pe restul RPC-urilor.
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "min_supported_version")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setMin((data?.value as MinVersion | null) ?? null);
      })
      .then(undefined, () => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!min) return null;
  const required = (min[platform] ?? "0.0.0") as string;
  if (!isBelowMinVersion(APP_VERSION, required)) return null;

  const storeHref = platform === "web" ? null : STORE_URL[platform];
  const message =
    (min.force_update_message ?? "").trim() ||
    "Această versiune nu mai este suportată. Actualizează pentru a continua.";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/95 p-6 backdrop-blur">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Actualizare obligatorie
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Versiune instalată: <code className="font-mono">{APP_VERSION}</code> · minimă:{" "}
          <code className="font-mono">{required}</code> ({platform})
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {storeHref ? (
            <a
              href={storeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Deschide magazinul
            </a>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Reîncarcă
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
