/**
 * Native push (FCM) integration for the Capacitor Android wrapper.
 *
 * Detects `Capacitor.isNativePlatform()` and runs entirely as a no-op on the
 * web (browser continues to use the existing Web Push flow).
 *
 * Responsibilities:
 *  - Request POST_NOTIFICATIONS at runtime (Android 13+).
 *  - Register with FCM and upsert the token in `push_subscriptions`
 *    (`kind='fcm'`, `platform='android'`).
 *  - Handle token rotation via the `registration` listener.
 *  - Create Android notification channels: `messages`, `matches`, `system`.
 *  - Route notification taps to the correct in-app URL (cold start + warm).
 *  - Foreground: suppress OS notification, hand off to sonner toast +
 *    in-app sound (respects the recipient's `NotificationSoundCard` prefs).
 *
 * Privacy: notification content is decided server-side (see
 * `web-push.server.ts` / `fcm-push.server.ts`) — this file only forwards the
 * payload the server chose to send.
 */
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notification-sound";
import { CHANNELS, RETIRED_CHANNEL_IDS } from "@/lib/notification-channels";

type NavigateFn = (path: string) => void;

const FCM_TOKEN_STORAGE_KEY = "suzeta.fcm_token";

let _initialized = false;
let _pendingUrl: string | null = null;
let _navigate: NavigateFn | null = null;

function persistFcmToken(token: string) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    }
  } catch {
    /* noop */
  }
}

export function readPersistedFcmToken(): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    }
  } catch {
    /* noop */
  }
  return null;
}

function clearPersistedFcmToken() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
    }
  } catch {
    /* noop */
  }
}

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Wire the router-aware navigate callback (called once from the app shell).
 * If a notification tap occurred before the router was ready, flush it now.
 */
export function setNativePushNavigator(navigate: NavigateFn) {
  _navigate = navigate;
  if (_pendingUrl) {
    const url = _pendingUrl;
    _pendingUrl = null;
    try {
      navigate(url);
    } catch {
      /* noop */
    }
  }
}

function goTo(url: string | undefined | null) {
  const target = (url || "/").trim() || "/";
  if (_navigate) {
    try {
      _navigate(target);
      return;
    } catch {
      /* fallthrough */
    }
  }
  _pendingUrl = target;
}

type Plugin = typeof import("@capacitor/push-notifications").PushNotifications;

/**
 * Canalele trebuie să existe ÎNAINTE ca prima notificare să sosească: un
 * payload care trimite spre un `channel_id` inexistent este afișat de FCM pe
 * canalul de rezervă „Miscellaneous”, cu importanță DEFAULT — fără heads-up.
 *
 * Vezi notification-channels.ts pentru motivul `_v2`.
 */
async function ensureChannels(PushNotifications: Plugin): Promise<void> {
  for (const id of RETIRED_CHANNEL_IDS) {
    // Canalele vechi aveau sunetul rupt. Nu pot fi reparate — doar retrase,
    // altfel rămân vizibile în setările Android fără să facă nimic.
    try {
      await PushNotifications.deleteChannel({ id });
    } catch {
      /* nu exista pe acest device */
    }
  }
  for (const c of CHANNELS) {
    try {
      // `sound` este OMIS intenționat: canalul primește sunetul implicit al
      // sistemului. Orice string aici devine un URI către res/raw/<string> și
      // face canalul mut.
      await PushNotifications.createChannel(c);
    } catch (e) {
      console.warn("[native-push] createChannel failed", c.id, e);
    }
  }
}

/**
 * Ascultătorii + register. Separate de cererea de permisiune, ca să poată fi
 * refăcute la FIECARE pornire a aplicației.
 *
 * De ce contează: `_initialized` trăiește în modul, deci moare odată cu
 * procesul. Cât timp acest cod rula doar din butonul „Activează”, la un cold
 * start nu exista niciun ascultător `pushNotificationActionPerformed` — un tap
 * pe notificare deschidea aplicația pe ecranul principal în loc de conversație
 * — și nici `register()`, deci un token rotit de FCM nu mai ajungea niciodată
 * în `push_subscriptions` și notificările se opreau în tăcere.
 */
async function wireListeners(
  PushNotifications: Plugin,
  opts: { saveToken: (token: string) => Promise<void> },
): Promise<void> {
  // Listener: token registration + rotation.
  await PushNotifications.addListener("registration", async (token) => {
    persistFcmToken(token.value);
    try {
      await opts.saveToken(token.value);
    } catch (e) {
      console.error("[native-push] saveToken failed", e);
    }
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.error("[native-push] registrationError", err);
  });

  // Foreground: don't display a system notification; show toast + play sound.
  await PushNotifications.addListener("pushNotificationReceived", (notif) => {
    const data = (notif.data ?? {}) as Record<string, string>;
    const title = notif.title || data.title || "Suzeta";
    const body = notif.body || data.body || "";
    try {
      playNotificationSound();
    } catch {
      /* noop */
    }
    toast(title, {
      description: body,
      action: data.url
        ? {
            label: "Deschide",
            onClick: () => goTo(data.url),
          }
        : undefined,
    });
  });

  // Tap on notification (background OR cold start).
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = (action.notification.data ?? {}) as Record<string, string>;
    goTo(data.url);
  });

  await PushNotifications.register();
}

/**
 * Activare explicită, din butonul de setări: cere permisiunea dacă e cazul.
 * Singurul loc care are voie să deschidă dialogul Android 13+.
 */
export async function initNativePush(opts: {
  saveToken: (token: string) => Promise<void>;
}): Promise<{ ok: boolean; reason?: string }> {
  if (_initialized) return { ok: true };
  if (!(await isNative())) return { ok: false, reason: "web" };

  let PushNotifications: Plugin;
  try {
    ({ PushNotifications } = await import("@capacitor/push-notifications"));
  } catch {
    return { ok: false, reason: "plugin_missing" };
  }

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  // Refuzul NU este o eroare: aplicația funcționează normal mai departe, doar
  // fără push. Apelantul oferă drumul către setările Android.
  if (perm.receive !== "granted") return { ok: false, reason: "denied" };

  await ensureChannels(PushNotifications);
  await wireListeners(PushNotifications, opts);
  _initialized = true;
  return { ok: true };
}

/**
 * Reluare la pornirea aplicației, pentru utilizatorii care au activat deja
 * notificările. NU cere niciodată permisiunea — dacă nu e acordată, iese tăcut.
 *
 * Fără asta, la fiecare cold start lipseau ascultătorii (deci deep link-ul din
 * notificare) și `register()` (deci reîmprospătarea token-ului).
 */
export async function resumeNativePush(opts: {
  saveToken: (token: string) => Promise<void>;
}): Promise<{ ok: boolean; reason?: string }> {
  if (_initialized) return { ok: true };
  if (!(await isNative())) return { ok: false, reason: "web" };

  let PushNotifications: Plugin;
  try {
    ({ PushNotifications } = await import("@capacitor/push-notifications"));
  } catch {
    return { ok: false, reason: "plugin_missing" };
  }

  const perm = await PushNotifications.checkPermissions();
  if (perm.receive !== "granted") return { ok: false, reason: "not_granted" };

  await ensureChannels(PushNotifications);
  await wireListeners(PushNotifications, opts);
  _initialized = true;
  return { ok: true };
}

/**
 * Deschide ecranul de notificări al aplicației din setările Android. Necesar
 * când permisiunea a fost refuzată: Android nu mai arată dialogul a doua oară,
 * deci singurul drum înapoi trece prin setări.
 */
export async function openNotificationSettings(): Promise<boolean> {
  if (!(await isNative())) return false;
  try {
    const { NativeSettings, AndroidSettings } = await import("capacitor-native-settings");
    await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
    return true;
  } catch (e) {
    console.warn("[native-push] openNotificationSettings failed", e);
    return false;
  }
}

/**
 * Best-effort cleanup on logout / disable. Uses the persisted FCM token to
 * drop the row from `push_subscriptions` so the previous user stops receiving
 * pushes on this shared device. Also removes native listeners and clears the
 * local token cache.
 */
export async function teardownNativePush(opts?: {
  removeToken?: (token: string) => Promise<void>;
}): Promise<void> {
  if (!(await isNative())) return;
  const token = readPersistedFcmToken();
  if (token && opts?.removeToken) {
    try {
      await opts.removeToken(token);
    } catch (e) {
      console.warn("[native-push] removeToken failed", e);
    }
  }
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
  } catch {
    /* noop */
  }
  clearPersistedFcmToken();
  _initialized = false;
}
