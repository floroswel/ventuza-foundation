/**
 * Wire the TanStack Router navigator into the native push module so that
 * `pushNotificationActionPerformed` (tap on notification, including cold start)
 * navigates to the URL from the payload's `data.url`.
 *
 * No-op on web (native-push init is a no-op there anyway).
 */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setNativePushNavigator } from "@/lib/native-push";

export function NativePushNavigatorMount() {
  const navigate = useNavigate();
  useEffect(() => {
    const go = (path: string) => {
      const target = (path || "/").trim() || "/";
      // TanStack Router refuză strict tipurile — dar aici primim URL-uri
      // decise server-side (payload.url), care sunt relative interne.
      navigate({ to: target as never }).catch(() => {
        if (typeof window !== "undefined") window.location.assign(target);
      });
    };
    setNativePushNavigator(go);

    // Web Push: service worker-ul cere navigarea la tap pe notificare.
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type === "SUZETA_NAVIGATE" && typeof data.url === "string") go(data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);
  return null;
}

