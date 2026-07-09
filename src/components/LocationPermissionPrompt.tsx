import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { MapPin, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useCountryGate } from "@/lib/country-gate";
import { toast } from "sonner";

/**
 * First-run location primer.
 *
 * Se afișează O SINGURĂ DATĂ per user, DOAR după login, DOAR dacă:
 *  - `profiles.location_sharing_enabled === true` (default true),
 *  - permisiunea browserului e încă `prompt` (nu am cerut-o niciodată),
 *  - țara userului nu forțează stealth / hide location / blocare.
 *
 * Explicăm DE CE cerem locația înainte să declanșăm dialogul nativ, ca să
 * nu pierdem permisiunea printr-un „Block" reflex. Dacă userul refuză aici,
 * marcăm ca văzut și nu mai insistăm — poate reactiva din Profil.
 */
const STORAGE_PREFIX = "ventuza_loc_prompt_seen_v1:";

function routeNeedsLocationPrimer(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/discover") ||
    pathname.startsWith("/nearby") ||
    pathname.startsWith("/cruise") ||
    pathname.startsWith("/visitors")
  );
}

export function LocationPermissionPrompt() {
  const { user } = useAuth();
  const location = useLocation();
  const { forceStealth, hidePreciseLocation, isBlocked } = useCountryGate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!routeNeedsLocationPrimer(location.pathname || "/")) setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const path = location.pathname || "/";
    if (!routeNeedsLocationPrimer(path)) return;
    if (forceStealth || hidePreciseLocation || isBlocked) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    const key = STORAGE_PREFIX + user.id;
    if (localStorage.getItem(key)) return;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("location_sharing_enabled")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && data.location_sharing_enabled === false) {
        localStorage.setItem(key, "1"); // respect user's off setting
        return;
      }
      // Verifică starea permisiunii — nu arătăm primer-ul dacă e deja granted/denied.
      try {
        const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
        if (perms && perms.query) {
          const st = await perms.query({ name: "geolocation" as PermissionName });
          if (cancelled) return;
          if (st.state !== "prompt") {
            localStorage.setItem(key, "1");
            return;
          }
        }
      } catch {
        /* Permissions API indisponibil — continuăm cu primer-ul. */
      }
      setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, location.pathname, forceStealth, hidePreciseLocation, isBlocked]);

  function markSeen() {
    if (user) localStorage.setItem(STORAGE_PREFIX + user.id, "1");
    setOpen(false);
  }

  async function handleAllow() {
    setBusy(true);
    try {
      const { getCurrentPosition } = await import("@/lib/native-geolocation");
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 });
      if (pos) {
        markSeen();
        void supabase.rpc("update_my_location", {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        });
        toast.success("Locația a fost activată");
      } else {
        markSeen();
        toast("Poți activa locația mai târziu din Profil → Confidențialitate");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!user) return;
    setBusy(true);
    try {
      await supabase
        .from("profiles")
        .update({ location_sharing_enabled: false })
        .eq("id", user.id);
      toast("Partajarea locației e dezactivată. O poți reporni din Profil.");
    } finally {
      setBusy(false);
      markSeen();
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loc-primer-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/20 bg-background shadow-2xl">
        <button
          type="button"
          aria-label="Închide"
          onClick={markSeen}
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
        <div className="px-6 pt-8 text-center">
          <div className="relative mx-auto mb-4 w-fit">
            <span className="absolute inset-0 -m-3 rounded-full bg-primary/15 blur-xl" aria-hidden />
            <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/40">
              <MapPin className="size-7 text-primary" />
            </span>
          </div>
          <h2 id="loc-primer-title" className="text-lg font-semibold tracking-tight">
            Activează locația
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Folosim locația ta ca să-ți arătăm persoane și locuri queer-friendly din apropiere.
            Distanța e afișată aproximativ (ex. „1&nbsp;km") — coordonatele tale exacte
            <strong> nu părăsesc niciodată</strong> dispozitivul și nu sunt vizibile altor useri.
          </p>
          <ul className="mt-4 space-y-1.5 text-left text-xs text-muted-foreground">
            <li>• O poți opri oricând din Profil → Confidențialitate.</li>
            <li>• Nu stocăm istoric de traseu.</li>
            <li>• În țări cu risc, ascundem automat locația precisă.</li>
          </ul>
        </div>
        <div className="mt-6 flex flex-col gap-2 px-6 pb-6">
          <button
            type="button"
            disabled={busy}
            onClick={handleAllow}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Se procesează…" : "Permite locația"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDisable}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
          >
            Nu acum
          </button>
        </div>
      </div>
    </div>
  );
}
