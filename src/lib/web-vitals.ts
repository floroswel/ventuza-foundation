import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;

export function initWebVitals() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const send = async (m: { name: string; value: number; rating?: string }) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("web_vitals").insert({
        user_id: u.user?.id ?? null,
        metric: m.name,
        value: m.value,
        rating: m.rating ?? null,
        path: window.location.pathname,
        user_agent: navigator.userAgent.slice(0, 200),
      });
    } catch {/* ignore */}
  };

  onCLS(send);
  onINP(send);
  onLCP(send);
  onFCP(send);
  onTTFB(send);
}
