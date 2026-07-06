// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // registration handled explicitly in src/lib/pwa-register.ts
        devOptions: { enabled: false },
        filename: "sw.js",
        // /push-sw.js has its own registration + scope for FCM/web-push and MUST NOT be
        // touched by workbox precache / navigation fallback.
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2,webmanifest}"],
          globIgnores: ["**/push-sw.js"],
          navigateFallback: "/",
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/~oauth/,
            /^\/push-sw\.js$/,
            /^\/_server/,
          ],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // App shell HTML — always try network, fall back to cache offline.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "vz-html",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              // Fonts (Google + self-hosted).
              urlPattern: ({ url }) =>
                url.origin === "https://fonts.googleapis.com" ||
                url.origin === "https://fonts.gstatic.com" ||
                /\.(woff2?|ttf|otf)$/i.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "vz-fonts",
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Own profile photos & already-viewed avatars (Supabase storage).
              urlPattern: ({ url, request }) =>
                request.destination === "image" &&
                (url.pathname.includes("/storage/v1/object/") ||
                  /\.(png|jpe?g|webp|gif|avif)$/i.test(url.pathname)),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "vz-images",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Conversation reads (messages + conversations tables via PostgREST).
              urlPattern: ({ url }) =>
                /\/rest\/v1\/(messages|conversations|profiles)/.test(url.pathname),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "vz-chat",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 3 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: false, // we already ship public/manifest.webmanifest
      }),
    ],
  },
});
