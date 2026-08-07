/**
 * Canalele de notificare Android.
 *
 * CAUZA notificărilor fără sunet: canalele `messages` și `matches` erau create
 * cu `sound: "default"`. Pluginul NU tratează "default" ca pe o valoare
 * specială — construiește un URI către o resursă brută
 * (NotificationChannelManager.java:88-98):
 *
 *     Uri.parse("android.resource://" + packageName + "/raw/" + sound)
 *
 * Proiectul nu are `res/raw`, deci canalele primeau un sunet inexistent și
 * rămâneau MUTE. Canalul `system`, singurul fără proprietatea `sound`, suna
 * corect — exact ce s-a observat pe telefon.
 *
 * Fixul este să OMITEM `sound`: un NotificationChannel fără sunet setat
 * primește automat sunetul implicit de notificare al sistemului, care este și
 * ce ne dorim („folosește sunetul default Android dacă nu există un motiv clar
 * pentru sunet custom”).
 *
 * DE CE `_v2`: Android păstrează pentru totdeauna setările unui canal. Odată
 * creat cu sunetul rupt, canalul rămâne mut oricât de corect ar fi codul —
 * inclusiv după update sau reinstalare, dacă utilizatorul are backup de
 * setări. Nici ștergerea nu ajută: recrearea unui canal cu ACELAȘI id îi
 * restaurează setările vechi. Singura cale curată este un id nou.
 * Canalul `system` nu se versionează: setările lui au fost mereu corecte.
 *
 * Ce NU facem: nu cerem bypass de Do Not Disturb, nu forțăm volum și nu
 * suprascriem alegerile utilizatorului. `vibration: true` doar PERMITE
 * vibrația — modul telefonului (sonerie / vibrație / silent / DND) decide.
 */

/** Android NotificationManager.IMPORTANCE_*. */
export const IMPORTANCE_DEFAULT = 3;
export const IMPORTANCE_HIGH = 4;

/** Android Notification.VISIBILITY_*. */
export const VISIBILITY_PRIVATE = 0;
export const VISIBILITY_PUBLIC = 1;

export type ChannelDef = {
  id: string;
  name: string;
  description: string;
  importance: 3 | 4;
  visibility: 0 | 1;
  vibration: boolean;
  lights?: boolean;
};

export const CHANNELS: readonly ChannelDef[] = [
  {
    id: "messages_v2",
    name: "Mesaje",
    description: "Mesaje directe și conversații",
    // HIGH = sunet + heads-up. `android.priority: HIGH` din payload NU ridică
    // importanța pe Android 8+: canalul are ultimul cuvânt.
    importance: IMPORTANCE_HIGH,
    // PRIVATE: pe ecranul blocat se vede că a venit un mesaj, nu conținutul.
    // Aplicația este una de dating — vezi și show_preview / discrete_mode.
    visibility: VISIBILITY_PRIVATE,
    vibration: true,
    lights: true,
  },
  {
    id: "matches_v2",
    name: "Match-uri și like-uri",
    description: "Match-uri noi, like-uri și saluturi",
    importance: IMPORTANCE_HIGH,
    visibility: VISIBILITY_PRIVATE,
    vibration: true,
    lights: true,
  },
  {
    id: "system",
    name: "Sistem",
    description: "Anunțuri și alerte",
    // DEFAULT: apare în shade, fără heads-up. Nu are nevoie de versionare —
    // nu a avut niciodată `sound` setat, deci sună deja corect.
    importance: IMPORTANCE_DEFAULT,
    visibility: VISIBILITY_PUBLIC,
    vibration: false,
  },
];

/** Canale create greșit înainte; se șterg ca să nu polueze setările Android. */
export const RETIRED_CHANNEL_IDS: readonly string[] = ["messages", "matches"];

/**
 * Canalul pentru un payload, după `type`/`tag`.
 * Folosit ȘI de server (alege `android.notification.channel_id`), ȘI de client
 * (creează canalele) — o singură sursă de adevăr, ca payload-ul să nu trimită
 * niciodată către un canal inexistent.
 */
export function channelIdForType(type: string | undefined | null): string {
  const t = (type || "").toLowerCase();
  if (t.includes("message") || t.includes("msg")) return "messages_v2";
  if (
    t.includes("match") ||
    t.includes("tap") ||
    t.includes("woof") ||
    t.includes("like") ||
    t.includes("favorite")
  ) {
    return "matches_v2";
  }
  return "system";
}

/** Toate id-urile pe care serverul le poate trimite trebuie să existe pe device. */
export function knownChannelIds(): string[] {
  return CHANNELS.map((c) => c.id);
}
