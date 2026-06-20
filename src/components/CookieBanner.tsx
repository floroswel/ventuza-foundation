import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "ventuza_cookie_consent_v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {}
  }, []);

  function accept(level: "all" | "essential") {
    try {
      localStorage.setItem(KEY, JSON.stringify({ level, ts: Date.now() }));
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-xs leading-relaxed text-foreground">
        Folosim cookies esențiale pentru autentificare și siguranță, plus analytics anonime
        pentru îmbunătățirea aplicației.{" "}
        <Link to="/legal/privacy" className="underline">
          Detalii
        </Link>
        .
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => accept("essential")}
          className="flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium"
        >
          Doar esențiale
        </button>
        <button
          onClick={() => accept("all")}
          className="flex-1 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          Accept toate
        </button>
      </div>
    </div>
  );
}
