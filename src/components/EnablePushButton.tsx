import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { savePushSubscription, removePushSubscription } from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/web-push-config";

function supported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export function EnablePushButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);

  useEffect(() => {
    if (!supported()) { setSubscribed(false); return; }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/push-sw.js")
          ?? await navigator.serviceWorker.register("/push-sw.js");
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub && Notification.permission === "granted");
      } catch {
        setSubscribed(false);
      }
    })();
  }, []);

  async function enable() {
    if (!supported()) { toast.error("Browserul tău nu suportă notificări push."); return; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("Notificările au fost respinse."); return; }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("subscription incompletă");
      await save({ data: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent.slice(0, 500),
      } });
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

  return (
    <Button
      type="button"
      variant={subscribed ? "outline" : "default"}
      size="sm"
      disabled={busy}
      onClick={subscribed ? disable : enable}
      className={className}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : subscribed ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      <span className="ml-2">{subscribed ? "Dezactivează notificările" : "Activează notificările"}</span>
    </Button>
  );
}
