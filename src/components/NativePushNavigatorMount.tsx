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
    setNativePushNavigator((path: string) => {
      const target = (path || "/").trim() || "/";
      // TanStack Router refuză strict tipurile — dar aici primim URL-uri
      // decise server-side (payload.url), care sunt relative interne.
      // Cast controlat, fără template literals dinamice care ar sparge tipurile.
      navigate({ to: target as never }).catch(() => {
        // fallback dur pentru orice URL neînregistrat în routeTree
        if (typeof window !== "undefined") window.location.assign(target);
      });
    });
  }, [navigate]);
  return null;
}
