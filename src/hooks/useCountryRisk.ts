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
// Mai multe componente montează hook-ul în același tick; fără promisiune
// partajată fiecare trimitea propriul RPC identic.
let inflight: Promise<{ country: string | null; risk: CountryRisk }> | null = null;

async function detectCountry(): Promise<string | null> {
  const { detectCountryCode } = await import("@/lib/geo-country");
  return detectCountryCode();
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
      inflight ??= (async () => {
        const cc = await detectCountry();
        if (!cc) return { country: null, risk: null as CountryRisk };
        const { data } = await supabase.rpc("get_country_risk", { _country_code: cc });
        const row = Array.isArray(data) && data.length > 0 ? (data[0] as CountryRisk) : null;
        return { country: cc, risk: row };
      })().then((res) => {
        cache = { at: Date.now(), ...res };
        inflight = null;
        return res;
      }).catch((e) => {
        inflight = null;
        throw e;
      });
      const res = await inflight;
      if (alive) setState({ loading: false, country: res.country, risk: res.risk });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
