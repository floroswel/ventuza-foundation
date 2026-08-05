/**
 * Integritate device (2.4) — semnale native de root / emulator.
 *
 * Fail-open by design: dacă bridge-ul nativ lipsește (web, versiuni vechi de
 * APK), întoarcem `false`. Semnalele sunt folosite pentru risk scoring și
 * avertizare, NU pentru a bloca userii legitimi.
 */

type IntegrityBridge = {
  isDeviceRooted?: () => boolean;
  isRunningOnEmulator?: () => boolean;
};

function bridge(): IntegrityBridge | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { SuzetaSignature?: IntegrityBridge }).SuzetaSignature;
  return candidate ?? null;
}

export function isDeviceRooted(): boolean {
  try {
    return bridge()?.isDeviceRooted?.() === true;
  } catch {
    return false;
  }
}

export function isRunningOnEmulator(): boolean {
  try {
    return bridge()?.isRunningOnEmulator?.() === true;
  } catch {
    return false;
  }
}

export type DeviceIntegrity = {
  rooted: boolean;
  emulator: boolean;
  /** true dacă vreun semnal de risc este prezent. */
  tampered: boolean;
};

export function getDeviceIntegrity(): DeviceIntegrity {
  const rooted = isDeviceRooted();
  const emulator = isRunningOnEmulator();
  return { rooted, emulator, tampered: rooted || emulator };
}
