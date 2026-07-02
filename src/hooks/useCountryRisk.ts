import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CountryRisk = {
  country_code: string;
  risk_level: "normal" | "elevated" | "high" | "blocked";
  hide_precise_location: boolean;
  force_stealth: boolean;
  disable_discover: boolean;
  disable_signup: boolean;
  reason: string | null;
} | null;

let cache: { at: number; country: string | null; risk: CountryRisk } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

async function detectCountry(): Promise<string | null> {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("cc_hint") : null;
    if (stored) return stored;
    const res = await fetch("https://ipapi.co/country/", { cache: "force-cache" });
    if (!res.ok) return null;
    const cc = (await res.text()).trim().toUpperCase();
    if (cc.length === 2 && typeof localStorage !== "undefined") localStorage.setItem("cc_hint", cc);
    return cc.length === 2 ? cc : null;
  } catch {
    return null;
  }
}

export function useCountryRisk(): { loading: boolean; country: string | null; risk: CountryRisk } {
  const [state, setState] = useState<{
    loading: boolean;
    country: string | null;
    risk: CountryRisk;
  }>({
    loading: true,
    country: null,
    risk: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (cache && Date.now() - cache.at < CACHE_TTL) {
        if (alive) setState({ loading: false, country: cache.country, risk: cache.risk });
        return;
      }
      const cc = await detectCountry();
      if (!cc) {
        cache = { at: Date.now(), country: null, risk: null };
        if (alive) setState({ loading: false, country: null, risk: null });
        return;
      }
      const { data } = await supabase.rpc("get_country_risk", { _country_code: cc });
      const row = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null;
      cache = { at: Date.now(), country: cc, risk: row };
      if (alive) setState({ loading: false, country: cc, risk: row });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
