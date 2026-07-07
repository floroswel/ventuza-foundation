import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { savePushSubscription, removePushSubscription, saveFcmSubscription, removeFcmSubscription } from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/web-push-config";
import { initNativePush, teardownNativePush } from "@/lib/native-push";

async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function EnablePushButton({
  className,
  enableOnly = false,
}: {
  className?: string;
  /** Dacă true, ascunde butonul când userul e deja abonat (fără opțiune de dezactivare). */
  enableOnly?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);

  useEffect(() => {
    if (!supported()) {
      setPermission("unsupported");
      setSubscribed(false);
      return;
    }
    setPermission(Notification.permission);
    (async () => {
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration("/push-sw.js")) ??
          (await navigator.serviceWorker.register("/push-sw.js"));
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub && Notification.permission === "granted");
      } catch {
        setSubscribed(false);
      }
    })();
  }, []);

  async function enable() {
    if (!supported()) {
      toast.error("Browserul tău nu suportă notificări push.");
      return;
    }
    if (Notification.permission === "denied") {
      setPermission("denied");
      toast.error("Notificările sunt blocate pe acest dispozitiv", {
        description: "Deblochează permisiunea Ventuza din setările telefonului/browserului, apoi revino aici.",
        duration: 8000,
      });
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Notificările au fost respinse.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
        throw new Error("subscription incompletă");
      await save({
        data: {
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent.slice(0, 500),
        },
      });
      setSubscribed(true);
      toast.success("Notificări activate.");
    } catch (e) {
      toast.error((e as Error).message || "Nu am putut activa notificările.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await remove({ data: { endpoint } });
      }
      setSubscribed(false);
      toast.success("Notificări dezactivate.");
    } catch (e) {
      toast.error((e as Error).message || "Eroare.");
    } finally {
      setBusy(false);
    }
  }

  if (subscribed === null) return null;
  if (enableOnly && subscribed) return null;
  if (permission === "denied") {
    return (
      <div className={className}>
        <Button type="button" variant="outline" size="sm" disabled className="w-full">
          <BellOff className="size-4" />
          <span className="ml-2">Notificările sunt blocate pe dispozitiv</span>
        </Button>
        <p className="mt-2 text-[11px] text-destructive">
          Permisiunea push este respinsă în telefon/browser. Aplicația poate afișa notificări în inbox,
          dar push-ul nu poate porni până când permisiunea este deblocată din setările dispozitivului.
        </p>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant={subscribed ? "outline" : "default"}
      size="sm"
      disabled={busy}
      onClick={subscribed ? disable : enable}
      className={className}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : subscribed ? (
        <BellOff className="size-4" />
      ) : (
        <Bell className="size-4" />
      )}
      <span className="ml-2">
        {subscribed ? "Dezactivează notificările" : "Activează notificările"}
      </span>
    </Button>
  );
}
