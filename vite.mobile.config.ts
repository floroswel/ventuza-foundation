/**
 * Build SPA static dedicat Capacitor (Android/iOS).
 *
 * Folosire: `bun run build:mobile`
 *
 * Generează `dist/` cu HTML + JS pur client-side (fără SSR / Worker).
 * NU afectează `bun run build` (web cu SSR pe Cloudflare).
 *
 * În mobil, toate apelurile către backend trec direct prin clientul Supabase
 * (auth + RLS). Server functions rămân disponibile pe web; pe mobil, dacă
 * vrei sa le folosești, le apelezi prin `fetch` la domeniul published Lovable.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Forțează codul izomorfic să creadă că nu e SSR.
    "process.env.MOBILE_BUILD": JSON.stringify("1"),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
    },
  },
});
