import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for Ventuza (Android wrapper).
 *
 * Două moduri:
 *  1) DEV / hot-reload: setezi `server.url` la URL-ul preview Lovable
 *     (vezi mai jos). Util pentru iterație rapidă fără rebuild.
 *  2) PROD: comentezi `server.url` și folosești bundle-ul local din `dist/`.
 *     Înainte de `npx cap sync` rulezi `bun run build`.
 */
const config: CapacitorConfig = {
  appId: "app.ventuza.mobile",
  appName: "Ventuza",
  webDir: "dist",
  // 👇 Comentează blocul `server` pentru build de Google Play (producție).
  server: {
    url: "https://31f90140-a9a7-481a-b09d-ae4df6103241.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0B0F",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0B0B0F",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0B0B0F",
    },
  },
};

export default config;
