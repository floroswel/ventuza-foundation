// Biometric unlock wrapper. Fingerprint/Face ID pe nativ (Android/iOS) prin
// capacitor-native-biometric; no-op pe web. Folosit ca alternativă la PIN
// în PinLockGate — dacă biometria e disponibilă și userul a activat-o,
// gate-ul o încearcă prima; PIN-ul rămâne fallback obligatoriu.
//
// Nu stocăm nimic sensibil aici — biometria doar autorizează deblocarea
// sesiunii locale (vz_pin_unlocked). Fără chei, fără token-uri, fără PII.

const PREF_KEY = "vz_bio_enabled";

async function isNative(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!(await isNative())) return false;
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    const res = await NativeBiometric.isAvailable();
    return !!res.isAvailable;
  } catch {
    return false;
  }
}

export function isBiometricEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PREF_KEY) === "1";
}

export function setBiometricEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) localStorage.setItem(PREF_KEY, "1");
  else localStorage.removeItem(PREF_KEY);
}

/**
 * Prompt biometric verification. Returns true dacă userul a trecut,
 * false dacă a anulat / a eșuat. Nu aruncă — caller-ul decide fallback.
 */
export async function verifyBiometric(reason = "Deblochează Ventuza"): Promise<boolean> {
  if (!(await isBiometricAvailable())) return false;
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason,
      title: "Ventuza",
      subtitle: reason,
      description: "Folosește biometria pentru a debloca aplicația.",
    });
    return true;
  } catch {
    return false;
  }
}
