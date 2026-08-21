// Sursă unică pentru pornirea/oprirea modului Incognito (`profiles.hide_online`).
//
// La DEZACTIVARE trebuie să reapari imediat: `last_seen` a rămas vechi cât ai
// fost ascuns, deci fără un `touch_last_seen` imediat userul rămâne "offline"
// până la următorul heartbeat (max 45s) — ceea ce pare că "dezactivarea nu
// funcționează". Emitem și un event local ca heartbeat-ul să reia instant,
// fără să depindă de realtime pe `profiles`.
import { supabase } from "@/integrations/supabase/client";

export const INCOGNITO_EVENT = "suzeta:incognito-change";

export async function setIncognito(userId: string, hidden: boolean) {
  const { error } = await supabase
    .from("profiles")
    .update({ hide_online: hidden })
    .eq("id", userId);
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
