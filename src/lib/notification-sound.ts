/**
 * Suzeta signature notification sound.
 *
 * Generated 100% în cod (Web Audio API) — nu descarcă fișiere audio, nu depinde
 * de assets externe. Sunetul e o "semnătură" scurtă (~450 ms) a brandului:
 *   - două note ascendente în intervalul perfect quintă (E5 → B5) cu un shimmer
 *     de octavă deasupra,
 *   - envelope soft (attack rapid, release lung), fără click,
 *   - filtru low-pass care se deschide → senzație "sparkle" fuchsia/rose.
 *
 * Mut / activ prin `localStorage['suzeta:notification-sound']` (default: on).
 * Respectă `prefers-reduced-motion` NU — sunetul e la fel pentru toți; există
 * override per-user din UI (setting dedicat, cf. `isNotificationSoundEnabled`).
 */

const STORAGE_KEY = "suzeta:notification-sound";

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Deblochează AudioContext la primul gest de user (cerință iOS/Safari). */
export function primeNotificationSound() {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  const resume = () => {
    if (c.state === "suspended") void c.resume();
    unlocked = true;
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
    window.removeEventListener("touchstart", resume);
  };
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });
  window.addEventListener("touchstart", resume, { once: true });
}

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

type Note = {
  /** frequency in Hz */
  f: number;
  /** start offset (s) */
  t: number;
  /** duration (s) */
  d: number;
  /** peak gain (0..1) */
  g: number;
  /** oscillator type */
  type?: OscillatorType;
};

/** E5 = 659.25, B5 = 987.77, E6 = 1318.51 — quintă perfectă + shimmer octavă. */
const SIGNATURE: Note[] = [
  { f: 659.25, t: 0.0, d: 0.22, g: 0.28, type: "sine" }, // E5 body
  { f: 1318.51, t: 0.0, d: 0.22, g: 0.08, type: "triangle" }, // E6 shimmer
  { f: 987.77, t: 0.12, d: 0.32, g: 0.3, type: "sine" }, // B5 body
  { f: 1975.53, t: 0.12, d: 0.32, g: 0.06, type: "triangle" }, // B6 shimmer
];

/**
 * Redă sunetul de notificare Suzeta. Sigur să fie apelat oricând — se auto-mut
 * dacă userul a dezactivat sau dacă AudioContext nu poate porni.
 */
export function playNotificationSound() {
  if (!isNotificationSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    // best-effort resume; dacă nu se poate (fără gest), sar peste
    void c.resume().catch(() => {});
  }

  const now = c.currentTime + 0.01;

  // Bus: low-pass care se deschide → shimmer + un master gain pentru fade global.
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(1, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1400, now);
  lp.frequency.exponentialRampToValueAtTime(6500, now + 0.25);
  lp.Q.value = 0.7;

  master.connect(lp).connect(c.destination);

  for (const n of SIGNATURE) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.f, now + n.t);

    // Envelope: attack 15ms, decay/release lung.
    g.gain.setValueAtTime(0.0001, now + n.t);
    g.gain.exponentialRampToValueAtTime(n.g, now + n.t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

    osc.connect(g).connect(master);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.d + 0.02);
  }
}

/**
 * Motor generic pentru micro-sunete de chat (mai scurte și mai discrete decât
 * semnătura de notificare). Aceleași garanții: mut dacă userul a dezactivat,
 * niciodată nu aruncă.
 */
function playNotes(notes: Note[], opts: { lpFrom: number; lpTo: number; tail: number }) {
  if (!isNotificationSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});

  const now = c.currentTime + 0.005;
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(1, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, now + opts.tail);

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(opts.lpFrom, now);
  lp.frequency.exponentialRampToValueAtTime(opts.lpTo, now + opts.tail * 0.6);
  lp.Q.value = 0.6;
  master.connect(lp).connect(c.destination);

  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.f, now + n.t);
    g.gain.setValueAtTime(0.0001, now + n.t);
    g.gain.exponentialRampToValueAtTime(n.g, now + n.t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    osc.connect(g).connect(master);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.d + 0.02);
  }
}

/** „Whoosh" scurt, descendent — mesaj trimis. */
export function playMessageSentSound() {
  playNotes(
    [
      { f: 880, t: 0, d: 0.09, g: 0.16, type: "sine" },
      { f: 587.33, t: 0.05, d: 0.12, g: 0.12, type: "sine" },
    ],
    { lpFrom: 2600, lpTo: 900, tail: 0.22 },
  );
}

/** Două note ascendente, foarte scurte — mesaj primit în conversația deschisă. */
export function playMessageReceivedSound() {
  playNotes(
    [
      { f: 783.99, t: 0, d: 0.1, g: 0.18, type: "sine" },
      { f: 1174.66, t: 0.07, d: 0.16, g: 0.14, type: "sine" },
      { f: 2349.32, t: 0.07, d: 0.16, g: 0.04, type: "triangle" },
    ],
    { lpFrom: 1200, lpTo: 6000, tail: 0.32 },
  );
}
