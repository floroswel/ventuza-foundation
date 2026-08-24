import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, X, Wallet } from "lucide-react";

const KEY = "suzeta:ambassador-welcome-dismissed";

export function AmbassadorWelcomeCard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-surface to-surface p-5">
      <button
        onClick={dismiss}
        aria-label="Închide"
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
      <Sparkles className="size-6 text-primary" />
      <h3 className="mt-2 text-base font-semibold">Bine ai venit în Suzeta!</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Suzeta e și rămâne gratuită. Fii partenerul nostru: invită prieteni cu linkul tău și
        primești dolari în portofel, pe care îi transformi în produse cu logo Suzeta.
      </p>
      <Link
        to="/wallet"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Wallet className="size-4" /> Deschide portofelul
      </Link>
    </section>
  );
}
