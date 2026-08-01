/* Suzeta Web Push service worker */
self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Suzeta", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Suzeta";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/";
  const absolute = new URL(raw, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = all.find((c) => c.url.startsWith(self.location.origin)) || all[0];
      if (client) {
        try {
          await client.focus();
        } catch {}
        // SPA-friendly: cere aplicației să navigheze (client.navigate poate
        // eșua când fereastra nu e controlată de acest service worker).
        try {
          client.postMessage({ type: "SUZETA_NAVIGATE", url: raw });
        } catch {}
        try {
          if (typeof client.navigate === "function" && !client.url.endsWith(raw)) {
            await client.navigate(absolute);
          }
        } catch {}
        return;
      }
      await self.clients.openWindow(absolute);
    })(),
  );
});

