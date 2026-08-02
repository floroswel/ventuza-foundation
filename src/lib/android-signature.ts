/**
 * Amprenta semnăturii APK-ului INSTALAT, expusă din MainActivity
 * (vezi `android-overrides/MainActivity.java`) prin `@JavascriptInterface`.
 *
 * Folosită doar în panoul de diagnostic din /auth ca să confirmăm că SHA-1-ul
 * build-ului rulat este trecut în clientul OAuth Android (package `app.suzeta`).
 */

type SignatureBridge = {
  getPackageName?: () => string;
  getSha1?: () => string;
  getSha256?: () => string;
  getInstallerPackage?: () => string;
  getInstallSource?: () => string;
  getGoogleDiagnosticLogs?: () => string;
};

export type NativeGoogleLog = {
  at?: number;
  stage?: string;
  exception?: string;
  message?: string;
  numericCode?: number;
  credentialType?: string;
};

export type AndroidSignatureInfo = {
  available: boolean;
  packageName: string | null;
  sha1: string | null;
  sha256: string | null;
  installerPackage: string | null;
  installSource: string | null;
  note?: string;
};

export function readAndroidSignature(): AndroidSignatureInfo {
  const bridge = (globalThis as unknown as { SuzetaSignature?: SignatureBridge }).SuzetaSignature;
  if (!bridge) {
    return {
      available: false,
      packageName: null,
      sha1: null,
      sha256: null,
      installerPackage: null,
      installSource: null,
      note: "Disponibil doar în build-ul Android nativ (de la Build 7 în sus).",
    };
  }
  const safe = (fn?: () => string): string | null => {
    try {
      const value = fn?.();
      return value && value.length > 0 ? value : null;
    } catch {
      return null;
    }
  };
  return {
    available: true,
    packageName: safe(bridge.getPackageName),
    sha1: safe(bridge.getSha1),
    sha256: safe(bridge.getSha256),
    installerPackage: safe(bridge.getInstallerPackage),
    installSource: safe(bridge.getInstallSource),
  };
}

export function readNativeGoogleLogs(): NativeGoogleLog[] {
  const bridge = (globalThis as unknown as { SuzetaSignature?: SignatureBridge }).SuzetaSignature;
  try {
    const raw = bridge?.getGoogleDiagnosticLogs?.();
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as NativeGoogleLog[]) : [];
  } catch {
    return [];
  }
}
