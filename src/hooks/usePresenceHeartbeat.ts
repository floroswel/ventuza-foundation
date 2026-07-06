// Presence heartbeat — cât timp userul e activ (tab visible + autentificat +
// hide_online=false), trimite `touch_last_seen` la 45s. Oprește la
// visibilitychange=hidden și la unmount. Respectă invisible mode: dacă
// `profiles.hide_online=true`, NU actualizează `last_seen` → userul nu apare
// online pe carduri (last_seen se învechește natural).
//
// Threshold "isOnline" e 2 min (vezi src/lib/discover.ts) → cu heartbeat la
// 45s tolerăm 2 ratări (network glitch) înainte să dispară punctul verde.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const HEARTBEAT_MS = 45_000;

export function usePresenceHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let hideOnline = false;

    async function loadHidePref() {
      const { data } = await supabase
        .from("profiles")
        .select("hide_online")
        .eq("id", user!.id)
        .maybeSingle();
      hideOnline = !!data?.hide_online;
    }

    async function tick() {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (hideOnline) return;
      try {
        await supabase.rpc("touch_last_seen");
      } catch {
        /* silent — network glitch e ok */
      }
    }

    function start() {
      if (timer) return;
      void tick(); // imediat
      timer = setInterval(() => void tick(), HEARTBEAT_MS);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }
    function onVis() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    // Reîncarcă preferința când se schimbă din Settings.
    const ch = supabase
      .channel(`presence-pref-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          hideOnline = !!(payload.new as { hide_online?: boolean }).hide_online;
        },
      )
      .subscribe();

    void loadHidePref().then(() => {
      if (document.visibilityState === "visible") start();
    });
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
      supabase.removeChannel(ch);
    };
  }, [user]);
}
