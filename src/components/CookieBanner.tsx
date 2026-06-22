import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "ventuza_cookie_consent_v2";

type Consent = {
  essential: true; // always on
  analytics: boolean;
  marketing: boolean;
  ts: number;
  v: 2;
};

export function getCookieConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Consent;
  } catch {
    return null;
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {}
  }, []);

  function save(c: Omit<Consent, "ts" | "v" | "essential">) {
    try {
      const payload: Consent = { essential: true, ...c, ts: Date.now(), v: 2 };
      localStorage.setItem(KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("ventuza:consent", { detail: payload }));
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Setări cookie-uri"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur"
    >
      {!showCustom ? (
        <>
          <p className="text-xs leading-relaxed text-foreground">
            Folosim cookie-uri esențiale pentru autentificare și siguranță. Cu acordul tău,
            adăugăm analytics anonime și măsurători de marketing pentru îmbunătățirea aplicației.{" "}
            <Link to="/legal/cookies" className="underline">
              Detalii
            </Link>
            .
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={() => save({ analytics: false, marketing: false })}
              className="rounded-full border border-border bg-background px-2 py-2 text-[11px] font-medium"
            >
              Refuz
            </button>
            <button
              onClick={() => setShowCustom(true)}
              className="rounded-full border border-border bg-background px-2 py-2 text-[11px] font-medium"
            >
              Personalizează
            </button>
            <button
              onClick={() => save({ analytics: true, marketing: true })}
              className="rounded-full bg-primary px-2 py-2 text-[11px] font-medium text-primary-foreground"
            >
              Accept tot
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Alege ce permiți</p>
          <div className="mt-3 space-y-2">
            <Row label="Esențiale" desc="Login, sesiune, securitate. Necesare." checked disabled />
            <Row label="Analytics" desc="Statistici anonime de utilizare." checked={analytics} onChange={setAnalytics} />
            <Row label="Marketing" desc="Măsurători campanii și recomandări." checked={marketing} onChange={setMarketing} />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowCustom(false)}
              className="flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs"
            >
              Înapoi
            </button>
            <button
              onClick={() => save({ analytics, marketing })}
              className="flex-1 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              Salvează
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
