import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config pentru Suzeta (Android wrapper).
 *
 * MOD DEV / hot-reload:
 *   CAPACITOR_DEV=1 npx cap sync
 *   → folosește URL-ul preview Lovable (live reload pe device).
 *
 * MOD PROD (Google Play):
 *   bun run build && npx cap sync
 *   → împachetează bundle-ul local din `dist/`.
 */
const isDev = process.env.CAPACITOR_DEV === "1";

const config: CapacitorConfig = {
  appId: "com.ventuza.dating",
  appName: "Suzeta",
  webDir: "dist/client",
  ...(isDev
    ? {
        server: {
          url: "https://31f90140-a9a7-481a-b09d-ae4df6103241.lovableproject.com?forceHideBadge=true",
          cleartext: true,
        },
      }
    : {}),
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
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
    PrivacyScreen: {
      enable: true,
      imageName: "Splash",
      preventScreenshots: true,
    },

  },
};

export default config;
