let topicSequence = 0;

/**
 * Supabase Realtime reutilizează automat un canal existent cu același topic.
 * Cum removeChannel() este asincron, un remount rapid (React Strict Mode,
 * navigare sau schimbare de sesiune) poate primi canalul vechi deja abonat și
 * orice .on("postgres_changes") nou aruncă înainte de render.
 *
 * Fiecare ciclu de viață primește propriul topic, astfel încât toate callback-
 * urile sunt înregistrate pe un canal nou înainte de unicul subscribe().
 */
export function uniqueRealtimeTopic(base: string): string {
  topicSequence += 1;
  return `${base}:${topicSequence.toString(36)}`;
}