/**
 * Build SPA static dedicat Capacitor (Android/iOS).
 *
 * Folosire: `bun run build:mobile`
 *
 * Generează `dist/` ca bundle static prin nitro preset `static`, astfel încât
 * Capacitor să poată împacheta totul fără runtime de Worker.
 *
 * NU afectează `bun run build` (web rămâne SSR pe Cloudflare).
 *
 * Pe mobil, codul client folosește direct clientul Supabase (auth + RLS).
 * Server functions rămân disponibile pe web; pe mobil le poți apela prin
 * fetch către domeniul published Lovable dacă ai nevoie.
 */
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
      prerender: { outputPath: "/index.html" },
    },
  },
  nitro: {
    preset: "static",
    output: { dir: "dist", publicDir: "dist" },
  },
  vite: {
    define: {
      "process.env.MOBILE_BUILD": JSON.stringify("1"),
    },
  },
});
