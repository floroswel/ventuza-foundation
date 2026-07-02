// Local-only PIN lock for the "discreet mode". The PIN is stored as a SHA-256 hash
// in localStorage — useful as a privacy speed-bump on a shared device, not as
// real auth (which is handled by Supabase Auth).
const PIN_KEY = "vz_pin_hash";
const UNLOCKED_KEY = "vz_pin_unlocked"; // session-scoped (sessionStorage)

async function hash(pin: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPin(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(PIN_KEY);
}

export async function setPin(pin: string) {
  if (pin.length < 4) throw new Error("PIN-ul trebuie să aibă min. 4 cifre.");
  localStorage.setItem(PIN_KEY, await hash(pin));
  sessionStorage.setItem(UNLOCKED_KEY, "1");
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY);
  sessionStorage.removeItem(UNLOCKED_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) return true;
  const ok = (await hash(pin)) === stored;
  if (ok) sessionStorage.setItem(UNLOCKED_KEY, "1");
  return ok;
}

export function isUnlocked(): boolean {
  if (typeof window === "undefined") return true;
  if (!localStorage.getItem(PIN_KEY)) return true;
  return sessionStorage.getItem(UNLOCKED_KEY) === "1";
}

export function lockNow() {
  sessionStorage.removeItem(UNLOCKED_KEY);
}
