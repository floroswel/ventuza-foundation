import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

// 76 țări unde relațiile same-sex sunt criminalizate (ILGA World 2024).
// Codurile ISO 3166-1 alpha-2. Lista include țări cu pedepse penale active.
const HOSTILE_COUNTRIES = new Set([
  "AF", "DZ", "BD", "BN", "CM", "TD", "KM", "CG", "EG", "ER", "ET", "GM", "GH",
  "GN", "GY", "IR", "IQ", "JM", "KE", "KW", "LB", "LY", "MY", "MV", "MR", "MA",
  "MM", "NA", "OM", "PK", "PS", "QA", "SA", "SN", "SL", "SO", "SS", "LK", "SD",
  "SY", "TZ", "TG", "TN", "TM", "UG", "AE", "UZ", "YE", "ZM", "ZW", "BI", "ER",
  "LR", "MW", "NG", "GW", "ST",
]);

const DISMISS_KEY = "ventuza_travel_warning_dismissed";

export function TravelWarning() {
  const [country, setCountry] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const dismissed = sessionStorage.getItem(DISMISS_KEY);
        if (dismissed) return;
        const res = await fetch("https://ipapi.co/json/", { cache: "force-cache" });
        if (!res.ok) return;
        const j = await res.json();
        const cc = String(j?.country_code || j?.country || "").toUpperCase();
        if (!active) return;
        if (cc && HOSTILE_COUNTRIES.has(cc)) {
          setCountry(j?.country_name || cc);
          setVisible(true);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setVisible(false);
  }

  if (!visible || !country) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-[70] mx-auto max-w-md rounded-2xl border border-amber-500/50 bg-amber-950/95 p-3 text-amber-50 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
        <div className="flex-1">
          <p className="text-sm font-medium">Atenție — {country}</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
            În această țară, relațiile same-sex pot fi criminalizate. Fii prudent cu profilul,
            locația și întâlnirile. Activează modul incognito din Setări.
          </p>
        </div>
        <button onClick={dismiss} aria-label="Închide" className="rounded-full p-1 hover:bg-amber-800/50">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
