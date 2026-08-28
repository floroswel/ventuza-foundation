import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { HOSTILE_COUNTRIES } from "@/lib/hostile-countries";

const DISMISS_KEY = "suzeta_travel_warning_dismissed";

export function TravelWarning() {
  const [country, setCountry] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const dismissed = sessionStorage.getItem(DISMISS_KEY);
        if (dismissed) return;
        const { detectCountryCode } = await import("@/lib/geo-country");
        const cc = await detectCountryCode();
        if (!active) return;
        if (cc && HOSTILE_COUNTRIES.has(cc)) {
          setCountry(cc);
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
        <button
          onClick={dismiss}
          aria-label="Închide"
          className="rounded-full p-1 hover:bg-amber-800/50"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
