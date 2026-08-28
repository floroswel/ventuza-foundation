// Sursă unică pentru modul Incognito.
//
// Sunt DOUĂ coloane distincte pe `profiles`, cu înțelesuri diferite:
//   • `incognito`   → „nu apar deloc în grilă / Discover / Nearby / profil public”
//   • `hide_online` → „nu se vede când sunt online” (last_seen ascuns)
//
// Modul Incognito (comutatorul din QuickProfileDrawer / Discover / Account)
// înseamnă AMBELE: dispari din grilă ȘI nu mai apari online. Comutatorul separat
// din Setări („Ascunde statusul online”) atinge doar `hide_online`.
//
// La DEZACTIVARE trebuie să reapari imediat: `last_seen` a rămas vechi cât ai
// fost ascuns, deci fără un `touch_last_seen` imediat userul rămâne "offline"
// până la următorul heartbeat (max 45s).
import { supabase } from "@/integrations/supabase/client";

export const INCOGNITO_EVENT = "suzeta:incognito-change";

async function applyIncognito(userId: string, patch: { incognito?: boolean; hide_online?: boolean }, hidden: boolean) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;

  if (!hidden) {
    // Reapari online instant.
    try {
      await supabase.rpc("touch_last_seen");
    } catch {
      /* network glitch — heartbeat-ul va relua oricum */
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INCOGNITO_EVENT, { detail: { hidden } }));
  }
}

/** Incognito complet: dispari din grilă ȘI ascunzi statusul online. */
export async function setIncognito(userId: string, hidden: boolean) {
  await applyIncognito(userId, { incognito: hidden, hide_online: hidden }, hidden);
}

/** Doar statusul online (Setări → „Ascunde statusul online”). Rămâi în grilă. */
export async function setHideOnline(userId: string, hidden: boolean) {
  await applyIncognito(userId, { hide_online: hidden }, hidden);
}
