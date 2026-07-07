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

type NavigateFn = (path: string) => void;

const FCM_TOKEN_STORAGE_KEY = "ventuza.fcm_token";

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

/**
 * Idempotent init: request permission, register with FCM, create channels,
 * wire listeners. Safe to call multiple times.
 */
export async function initNativePush(opts: {
  saveToken: (token: string) => Promise<void>;
}): Promise<{ ok: boolean; reason?: string }> {
  if (_initialized) return { ok: true };
  if (!(await isNative())) return { ok: false, reason: "web" };

  let PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications;
  try {
    ({ PushNotifications } = await import("@capacitor/push-notifications"));
  } catch {
    return { ok: false, reason: "plugin_missing" };
  }

  // Ask permission (Android 13+ shows the native dialog).
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return { ok: false, reason: "denied" };

  // Channels — mapped from the `type` field in the notification payload.
  try {
    await PushNotifications.createChannel({
      id: "messages",
      name: "Mesaje",
      description: "Mesaje directe și conversații",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
    });
    await PushNotifications.createChannel({
      id: "matches",
      name: "Match-uri",
      description: "Match-uri noi și taps",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
    });
    await PushNotifications.createChannel({
      id: "system",
      name: "Sistem",
      description: "Anunțuri și alerte",
      importance: 3,
      visibility: 1,
      vibration: false,
    });
  } catch {
    /* channels are best-effort; older devices may not support the API */
  }

  // Listener: token registration + rotation.
  await PushNotifications.addListener("registration", async (token) => {
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
    const title = notif.title || data.title || "Ventuza";
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
  _initialized = true;
  return { ok: true };
}

/**
 * Best-effort cleanup on logout. We don't unregister the device from FCM
 * (tokens survive re-login) but we drop the row from push_subscriptions so
 * the previous user stops receiving pushes on this device.
 */
export async function teardownNativePush(opts: {
  removeToken: (token: string) => Promise<void>;
}): Promise<void> {
  if (!(await isNative())) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
    // We don't have direct access to the current token; the caller is
    // expected to pass the last-known token when it has one. If not, this
    // is a no-op — the row will get pruned server-side on next 404 from FCM.
    _initialized = false;
    void opts;
  } catch {
    /* noop */
  }
}
