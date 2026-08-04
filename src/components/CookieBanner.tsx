import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const KEY = "suzeta_cookie_consent_v2";
const LEGACY_KEY = "ventuza_cookie_consent_v2";

type Consent = {
  essential: true; // always on
  analytics: boolean;
  marketing: boolean;
  ts: number;
  v: 2;
};

/** Migrare one-shot a consimțământului salvat sub brandul vechi. */
export function migrateLegacyCookieConsent(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(KEY)) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem(KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getCookieConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    migrateLegacyCookieConsent();
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Consent;
  } catch {
    return null;
  }
}

export function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Pe aplicația nativă (Capacitor Android/iOS) NU afișăm banner-ul de
    // cookies — nu există cookies third-party într-un WebView nativ, iar
    // Play Store cere ca UI-ul nativ să nu imite dialoguri web irelevante.
    // Consimțămintele reale (analytics/marketing) rămân gestionate din
    // Settings → Consimțăminte, care este sursa unică pe nativ.
    try {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor;
      if (cap?.isNativePlatform?.()) return;
    } catch {
      /* ignore */
    }
    try {
      migrateLegacyCookieConsent();
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  function save(c: Omit<Consent, "ts" | "v" | "essential">) {
    try {
      const payload: Consent = { essential: true, ...c, ts: Date.now(), v: 2 };
      localStorage.setItem(KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("suzeta:consent", { detail: payload }));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("cookies.ariaLabel")}
      className="fixed inset-x-3 bottom-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom)))] z-[60] mx-auto max-h-[70dvh] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur"
    >
      {!showCustom ? (
        <>
          <p className="text-xs leading-relaxed text-foreground">
            {t("cookies.intro")}{" "}
            <Link to="/legal/cookies" className="underline">
              {t("cookies.details")}
            </Link>
            .
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={() => save({ analytics: false, marketing: false })}
              className="rounded-full border border-border bg-background px-2 py-2 text-[11px] font-medium"
            >
              {t("cookies.reject")}
            </button>
            <button
              onClick={() => setShowCustom(true)}
              className="rounded-full border border-border bg-background px-2 py-2 text-[11px] font-medium"
            >
              {t("cookies.customize")}
            </button>
            <button
              onClick={() => save({ analytics: true, marketing: true })}
              className="rounded-full bg-primary px-2 py-2 text-[11px] font-medium text-primary-foreground"
            >
              {t("cookies.acceptAll")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">{t("cookies.pickTitle")}</p>
          <div className="mt-3 space-y-2">
            <Row label={t("cookies.essential")} desc={t("cookies.essentialDesc")} checked disabled />
            <Row
              label={t("cookies.analytics")}
              desc={t("cookies.analyticsDesc")}
              checked={analytics}
              onChange={setAnalytics}
            />
            <Row
              label={t("cookies.marketing")}
              desc={t("cookies.marketingDesc")}
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowCustom(false)}
              className="flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs"
            >
              {t("cookies.back")}
            </button>
            <button
              onClick={() => save({ analytics, marketing })}
              className="flex-1 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              {t("cookies.save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-2">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </label>
  );
}
