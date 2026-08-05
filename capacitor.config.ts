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
  appId: "app.suzeta",
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
    backgroundColor: "#0B0B10",
    // Fără debug WebView în release și fără zoom de browser în pagină.
    webContentsDebuggingEnabled: false,
    useLegacyBridge: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#0B0B10",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersiveType: false,
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0B0B10",
      overlaysWebView: true,
    },
    Keyboard: {
      // `body`/`native` rescriu înălțimea documentului și blochează scroll-ul
      // vertical în WebView. Gestionăm noi spațiul prin --keyboard-height.
      resize: "none",
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
