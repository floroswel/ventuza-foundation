// Un singur loc care anunță aplicația că relațiile de blocare s-au schimbat.
// Grila Discover și lista de conversații ascultă evenimentul și se reîncarcă,
// ca persoana blocată să dispară instant (și să reapară la deblocare) fără
// refresh manual. Mesajele NU se șterg din DB — doar se ascund din UI.
export const BLOCKS_CHANGED_EVENT = "suzeta:blocks-changed";

export async function emitBlocksChanged() {
  try {
    const { clearDiscoverCache } = await import("@/lib/discover");
    clearDiscoverCache();
  } catch {
    /* modul indisponibil — evenimentul rămâne util */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BLOCKS_CHANGED_EVENT));
  }
}
