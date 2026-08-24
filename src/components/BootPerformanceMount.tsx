import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  markFirstRender,
  markInteractive,
  scheduleInteractiveFallback,
} from "@/lib/perf-metrics";

/**
 * Orchestrarea pornirii:
 *  - marchează primul render și TTI (instrumentare pe device real),
 *  - pornește în paralel preîncărcarea datelor esențiale,
 *  - instalează cache-ul persistent de imagini,
 *  - programează recompresia pozelor vechi în idle.
 *
 * Tot ce e aici este best-effort: nimic nu blochează randarea.
 */
export function BootPerformanceMount() {
  const { user, loading } = useAuth();

  useEffect(() => {
    markFirstRender();
    scheduleInteractiveFallback();
    void import("@/lib/image-cache-sw").then(({ registerImageCacheSw }) =>
      registerImageCacheSw(),
    );
  }, []);

  useEffect(() => {
    if (loading) return;
    // Sesiunea e rezolvată → primul ecran util poate fi randat.
    markInteractive();
    if (!user?.id) return;

    let cancelled = false;
    void (async () => {
      const [{ prefetchEssentials }, { supabase }] = await Promise.all([
        import("@/lib/boot-prefetch"),
        import("@/integrations/supabase/client"),
      ]);
      if (cancelled) return;
      await prefetchEssentials(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("photos")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const photos = (data?.photos ?? []) as string[];
      const { schedulephotoOptimization } = await import("@/lib/photo-optimizer");
      schedulephotoOptimization(photos);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]);

  return null;
}

export default BootPerformanceMount;
