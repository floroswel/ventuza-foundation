/**
 * Build SPA static dedicat Capacitor (Android/iOS).
 *
 * Folosire: `bun run build:mobile`
 *
 * Generează `dist/client/` ca bundle SPA static, fără nitro/SSR, astfel încât
 * Capacitor să poată împacheta totul fără runtime de Worker.
 *
 * NU afectează `bun run build` (web rămâne SSR pe Cloudflare).
 */
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
      prerender: { outputPath: "/index.html" },
    },
  },
  vite: {
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    environments: {
      client: {
        build: {
          outDir: "dist/client",
        },
      },
    },
    define: {
      "process.env.MOBILE_BUILD": JSON.stringify("1"),
    },
  },
});
