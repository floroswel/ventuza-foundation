/**
 * Detectarea unei versiuni mai noi publicate în Google Play.
 *
 * Sursa de adevăr este `https://suzeta.app/app-version.json`, generat din
 * `release/version.json` (vezi scripts/write-version-asset.mjs) și publicat
 * odată cu web-ul. Pipeline-ul Android urcă în Play exact acel versionCode,
 * deci dacă remote > local înseamnă că userul are un build vechi.
 *
 * ROLLOUT ETAPIZAT: `rolloutPercent` din app-version.json (5 → 25 → 100)
 * decide CÂȚI utilizatori văd bannerul. Bucket-ul este stabil per instalare
 * (hash pe un id local aleator, fără date personale, fără server), deci un
 * device care a intrat în valul de 5% rămâne în el și la 25%.
 *
 * DIAGNOSTIC: `checkForAppUpdateDetailed()` întoarce motivul exact pentru
 * care bannerul NU apare (platformă, fetch, versiuni, dismiss, rollout) —
 * folosit de cardul din Setări ca să nu mai ghicim.
 *
 * Zero date personale trimise: e un simplu GET pe un fișier static.
 */
import { APP_VERSION_CODE, APP_VERSION, detectPlatform } from "@/lib/app-version";

const VERSION_URL = "https://suzeta.app/app-version.json";
const DISMISS_KEY = "suzeta.update_dismissed_code";
const ROLLOUT_ID_KEY = "suzeta.rollout_id";
const CHECK_TIMEOUT_MS = 6000;

/** Eveniment pe care butonul „Verifică update” îl emite ca să forțeze bannerul. */
export const UPDATE_CHECK_EVENT = "suzeta:check-update";

export type RemoteVersion = {
  versionName: string;
  versionCode: number;
  notes?: string;
  rolloutPercent?: number;
};

export type UpdateReason =
  | "update_available"
  | "not_native"
  | "fetch_failed"
  | "bad_payload"
  | "up_to_date"
  | "dismissed"
  | "rollout_holdback";

export type UpdateDiagnostics = {
  reason: UpdateReason;
  update: RemoteVersion | null;
  platform: string;
  localVersionName: string;
  localVersionCode: number;
  remoteVersionName: string | null;
  remoteVersionCode: number | null;
  rolloutPercent: number | null;
  /** 0–99, stabil per instalare; bannerul apare dacă bucket < rolloutPercent. */
  rolloutBucket: number;
  dismissedCode: number;
  forced: boolean;
  checkedAt: string;
  httpStatus: number | null;
  error: string | null;
};

export function dismissUpdate(code: number) {
  try {
    localStorage.setItem(DISMISS_KEY, String(code));
  } catch {
    /* noop */
  }
}

function dismissedCode(): number {
  try {
    return Number.parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

/** Id aleator, local, fără legătură cu contul — doar pentru bucket-ul de rollout. */
function rolloutId(): string {
  try {
    const existing = localStorage.getItem(ROLLOUT_ID_KEY);
    if (existing) return existing;
    const fresh =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ROLLOUT_ID_KEY, fresh);
    return fresh;
  } catch {
    return "anonymous";
  }
}

/** FNV-1a → bucket 0–99, determinist pe (instalare, versionCode). */
export function rolloutBucketFor(id: string, versionCode: number): number {
  const input = `${id}:${versionCode}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

/**
 * Verificare completă, cu motivul deciziei. `force` ignoră dismiss-ul,
 * holdback-ul de rollout și restricția „doar nativ” — folosit de butonul de
 * test din Setări.
 */
export async function checkForAppUpdateDetailed(
  opts: { force?: boolean } = {},
): Promise<UpdateDiagnostics> {
  const forced = opts.force === true;
  const platform = detectPlatform();
  const base: UpdateDiagnostics = {
    reason: "up_to_date",
    update: null,
    platform,
    localVersionName: APP_VERSION,
    localVersionCode: APP_VERSION_CODE,
    remoteVersionName: null,
    remoteVersionCode: null,
    rolloutPercent: null,
    rolloutBucket: rolloutBucketFor(rolloutId(), APP_VERSION_CODE),
    dismissedCode: dismissedCode(),
    forced,
    checkedAt: new Date().toISOString(),
    httpStatus: null,
    error: null,
  };

  // Doar pe nativ: pe web nu există „instalare veche”, browserul ia mereu
  // ultimul bundle.
  if (!forced && platform !== "android" && platform !== "ios") {
    return { ...base, reason: "not_native" };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    base.httpStatus = res.status;
    if (!res.ok) return { ...base, reason: "fetch_failed", error: `HTTP ${res.status}` };

    const data = (await res.json()) as RemoteVersion;
    const code = Number(data?.versionCode);
    if (!Number.isFinite(code)) return { ...base, reason: "bad_payload", error: "versionCode invalid" };

    const percentRaw = Number(data?.rolloutPercent);
    const percent = Number.isFinite(percentRaw) ? Math.max(0, Math.min(100, percentRaw)) : 100;
    const bucket = rolloutBucketFor(rolloutId(), code);
    const update: RemoteVersion = {
      versionName: String(data.versionName || ""),
      versionCode: code,
      notes: data.notes,
      rolloutPercent: percent,
    };
    const diag: UpdateDiagnostics = {
      ...base,
      remoteVersionName: update.versionName,
      remoteVersionCode: code,
      rolloutPercent: percent,
      rolloutBucket: bucket,
      update,
    };

    if (code <= APP_VERSION_CODE) return { ...diag, reason: "up_to_date", update: forced ? update : null };
    if (!forced && diag.dismissedCode >= code) return { ...diag, reason: "dismissed", update: null };
    if (!forced && bucket >= percent) return { ...diag, reason: "rollout_holdback", update: null };
    return { ...diag, reason: "update_available" };
  } catch (e) {
    return { ...base, reason: "fetch_failed", error: e instanceof Error ? e.message : "eroare rețea" };
  } finally {
    clearTimeout(t);
  }
}

/** Text scurt, în română, pentru fiecare motiv — afișat în cardul de diagnostic. */
export function explainUpdateReason(d: UpdateDiagnostics): string {
  switch (d.reason) {
    case "update_available":
      return `Actualizare disponibilă: build ${d.remoteVersionCode} > instalat ${d.localVersionCode}.`;
    case "not_native":
      return `Rulezi pe „${d.platform}” — bannerul apare doar în aplicația nativă (Android/iOS).`;
    case "fetch_failed":
      return `Nu am putut citi app-version.json (${d.error ?? "eroare"}).`;
    case "bad_payload":
      return "app-version.json nu conține un versionCode valid.";
    case "up_to_date":
      return `Ești la zi: instalat ${d.localVersionCode}, publicat ${d.remoteVersionCode ?? "?"}.`;
    case "dismissed":
      return `Ai respins deja build-ul ${d.remoteVersionCode} (dismiss salvat: ${d.dismissedCode}).`;
    case "rollout_holdback":
      return `Rollout etapizat: build-ul ${d.remoteVersionCode} e la ${d.rolloutPercent}%, iar acest dispozitiv e în bucket-ul ${d.rolloutBucket}. Va apărea la o etapă următoare.`;
    default:
      return "Stare necunoscută.";
  }
}

/**
 * Întoarce versiunea remote dacă trebuie afișat bannerul, altfel `null`.
 * Păstrat pentru compatibilitate cu `UpdateAvailableBanner`.
 */
export async function checkForAppUpdate(opts: { force?: boolean } = {}): Promise<RemoteVersion | null> {
  const d = await checkForAppUpdateDetailed(opts);
  return d.reason === "update_available" || (opts.force && d.update) ? d.update : null;
}

/** Resetează dismiss-ul, ca butonul de test să poată reafișa bannerul. */
export function resetUpdateDismiss() {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* noop */
  }
}

/** Cere bannerului să reverifice imediat (folosit de butonul din Setări). */
export function requestUpdateCheck(force = true) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UPDATE_CHECK_EVENT, { detail: { force } }));
}

export { APP_VERSION, APP_VERSION_CODE };
