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

export type SigningCertificateMatch =
  | "app_signing"
  | "upload"
  | "internal_app_sharing"
  | "unmatched"
  | "reference_fingerprints_missing";

function normalizeSha1(value?: string | null): string {
  return (value ?? "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

export function classifySigningCertificate(actualSha1?: string | null): {
  match: SigningCertificateMatch;
  label: string;
} {
  const actual = normalizeSha1(actualSha1);
  const candidates = [
    ["app_signing", "App signing key certificate", import.meta.env.VITE_ANDROID_APP_SIGNING_SHA1],
    ["upload", "Upload key certificate", import.meta.env.VITE_ANDROID_UPLOAD_SHA1],
    ["internal_app_sharing", "Internal App Sharing certificate", import.meta.env.VITE_ANDROID_IAS_SHA1],
  ] as const;
  const configured = candidates.filter(([, , value]) => normalizeSha1(value));
  if (!actual || configured.length === 0) {
    return { match: "reference_fingerprints_missing", label: "Amprentele de referință nu sunt injectate în build" };
  }
  const found = configured.find(([, , value]) => normalizeSha1(value) === actual);
  if (found) return { match: found[0], label: found[1] };
  return { match: "unmatched", label: "Niciun certificat de referință nu corespunde" };
}

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
