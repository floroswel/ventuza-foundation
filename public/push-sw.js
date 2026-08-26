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


/* ---------------------------------------------------------------------------
 * Cache persistent pentru imaginile din Supabase Storage.
 *
 * URL-urile semnate conțin un token în query string care se schimbă la fiecare
 * re-semnare, deci potrivim cache-ul ignorând query-ul (`ignoreSearch`) și
 * cheia devine calea obiectului. Strategie: cache-first + revalidare în fundal,
 * cu plafon de intrări ca să nu umplem device-ul.
 * ------------------------------------------------------------------------ */
const IMG_CACHE = "suzeta-img-v1";
const IMG_CACHE_MAX = 220;

function isStorageImage(url) {
  return (
    /\/storage\/v1\/object\/(sign|public)\//.test(url.pathname) &&
    /\.(jpe?g|png|webp|gif|avif)$/i.test(url.pathname)
  );
}

async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMG_CACHE_MAX) return;
  await Promise.all(keys.slice(0, keys.length - IMG_CACHE_MAX).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (!isStorageImage(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            cache.put(req, res.clone()).then(() => trimImageCache(cache));
          } else if (res && (res.status === 400 || res.status === 403 || res.status === 404)) {
            // Obiectul a fost șters (ex: poză respinsă de moderare) — nu mai
            // servim varianta veche din cache pe termen nelimitat.
            cache.delete(req, { ignoreSearch: true });
          }
          return res;
        })
        .catch(() => null);

      if (cached) return cached;
      const fresh = await network;
      return fresh || new Response("", { status: 504 });
    })(),
  );
});

