/**
 * Preîncărcare paralelă la pornire.
 *
 * Înainte, boot-ul era o serie de round-trip-uri secvențiale:
 *   sesiune → profil → semnare URL-uri poze → primul ecran.
 * Aici pornim tot ce se poate în paralel imediat ce știm user-ul, și
 * pre-decodăm avatarul propriu ca primul ecran să nu mai aștepte rețeaua.
 *
 * Rulează o singură dată per lansare, e best-effort și nu aruncă niciodată.
 */

import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/signed-url-cache";
import { markBootDataReady } from "@/lib/perf-metrics";

let started = false;

function preloadImage(url: string) {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

export async function prefetchEssentials(userId: string): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;

  try {
    const profileP = supabase
      .from("profiles")
      .select("id, display_name, photos, hide_online, age_status, streak_days")
      .eq("id", userId)
      .maybeSingle();

    // Pornim în paralel cu profilul, nu după el: lista de conversații e
    // necesară pentru badge-ul de mesaje de pe primul ecran.
    const convP = supabase
      .from("conversations")
      .select("id, user_a, user_b")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .then(
        (r) => r,
        () => null,
      );

    const [{ data: profile }] = await Promise.all([profileP, convP]);

    const photos = (profile?.photos ?? []) as string[];
    if (photos.length) {
      // Un singur request de semnare pentru toate pozele proprii, apoi
      // pre-descărcăm prima (avatarul) ca să fie deja în cache la render.
      const urls = await getSignedUrls("profile-photos", photos.slice(0, 3));
      const first = urls[photos[0]];
      if (first) preloadImage(first);
    }
  } catch {
    /* prefetch-ul nu trebuie să blocheze pornirea */
  } finally {
    markBootDataReady();
  }
}

/** Resetare pentru logout / schimbare de cont. */
export function resetPrefetch() {
  started = false;
}
