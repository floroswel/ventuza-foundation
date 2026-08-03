/**
 * Amprenta semnăturii APK-ului INSTALAT, expusă din MainActivity
 * (vezi `android-overrides/MainActivity.java`) prin `@JavascriptInterface`.
 *
 * Folosită doar în panoul de diagnostic din /auth ca să confirmăm că SHA-1-ul
 * build-ului rulat este trecut în clientul OAuth Android (package `app.suzeta`).
 */

type SignatureBridge = {
  getAll?: () => string;
  getPackageName?: () => string;
  getSha1?: () => string;
  getSha256?: () => string;
  getInstallerPackage?: () => string;
  getInstallSource?: () => string;
  getGoogleDiagnosticLogs?: () => string;
  getVersionName?: () => string;
  getVersionCode?: () => string;
  getLogcat?: () => string;
};

export type NativeGoogleLog = {
  at?: number;
  stage?: string;
  exception?: string;
  message?: string;
  numericCode?: number;
  credentialType?: string;
  cause?: string;
  stack?: string;
};

export type AndroidSignatureInfo = {
  available: boolean;
  packageName: string | null;
  sha1: string | null;
  sha256: string | null;
  installerPackage: string | null;
  installSource: string | null;
  versionName: string | null;
  versionCode: string | null;
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
      versionName: null,
      versionCode: null,
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
  // Sursa primară: un singur apel nativ care citește PackageManager + certificat.
  let all: Record<string, string> = {};
  try {
    const raw = bridge.getAll?.();
    if (raw) all = JSON.parse(raw) as Record<string, string>;
  } catch {
    all = {};
  }
  const pick = (key: string, fn?: () => string): string | null => {
    const v = all[key];
    if (typeof v === "string" && v.length > 0) return v;
    return safe(fn);
  };
  return {
    available: true,
    packageName: pick("packageName", bridge.getPackageName),
    sha1: pick("sha1", bridge.getSha1),
    sha256: pick("sha256", bridge.getSha256),
    installerPackage: pick("installerPackage", bridge.getInstallerPackage),
    installSource: pick("installSource", bridge.getInstallSource),
    versionName: pick("versionName", bridge.getVersionName),
    versionCode: pick("versionCode", bridge.getVersionCode),
    note: all.error ?? all.versionError,
  };

}

/** Etichetă lizibilă pentru sursa instalării. */
export function describeInstallSource(info: AndroidSignatureInfo | null): string {
  if (!info?.available) return "n/a (web)";
  const installer = info.installerPackage ?? "";
  if (installer === "com.android.vending") return "Google Play (com.android.vending)";
  if (installer === "com.google.android.apps.internal.appsharing" || installer.includes("appsharing")) {
    return `Internal App Sharing (${installer})`;
  }
  if (!installer) return "Instalare locală (adb / sideload)";
  return `Altă sursă (${installer})`;
}

/** Linii logcat relevante ale propriului proces, deja filtrate/redactate nativ. */
export function readNativeLogcat(): string[] {
  const bridge = (globalThis as unknown as { SuzetaSignature?: SignatureBridge }).SuzetaSignature;
  try {
    const raw = bridge?.getLogcat?.() ?? "";
    return raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(-120);
  } catch {
    return [];
  }
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
