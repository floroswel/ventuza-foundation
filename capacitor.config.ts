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
  ios: {
    // Fundal identic cu splash-ul, ca tranziția să nu clipească alb.
    backgroundColor: "#0B0B10",
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
    // Scroll nativ iOS (bounce) dezactivat: aplicația are propriile liste.
    scrollEnabled: true,
    preferredContentMode: "mobile",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0B10",
    // Fără debug WebView în release și fără zoom de browser în pagină.
    webContentsDebuggingEnabled: false,
    useLegacyBridge: false,
  },
  plugins: {
    SplashScreen: {
      // `launchAutoHide: false` + `SplashScreen.hide()` apelat din aplicație,
      // în momentul în care primul ecran chiar are conținut (vezi
      // src/lib/splash.ts).
      //
      // Varianta veche era un cronometru fix de 900ms, deconectat de starea
      // reală, deci greșea în ambele sensuri: dacă aplicația era gata în
      // 300ms se aștepta degeaba 600ms, iar dacă pornirea dura 3s splash-ul
      // dispărea la 900ms și utilizatorul rămânea 2s pe un ecran gol — exact
      // senzația de „nu se încarcă". `SplashScreen.hide()` nu era apelat
      // nicăieri în tot codul.
      //
      // `launchShowDuration` rămâne ca plasă de siguranță: dacă JS-ul moare
      // înainte să apuce să ascundă splash-ul, Android nu rămâne blocat pe el.
      launchShowDuration: 4000,
      launchAutoHide: false,
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
      // `resize` este documentat ca "Only available on iOS" în @capacitor/keyboard 8.
      // Pe iOS `none` înseamnă că nu se rescrie înălțimea documentului.
      resize: "none",
      // Pe Android acesta este SINGURUL mecanism de compensare, dovedit pe telefon:
      //
      //   build 21: resizeOnFullScreen ON  + compensare CSS → composer urcat de
      //             DOUĂ ori (ieșea din containerul cu overflow-hidden);
      //   build 22: resizeOnFullScreen OFF + compensare CSS → composer nu urcă
      //             deloc, deci insetul IME nu ajunge niciodată în CSS.
      //
      // Concluzia A/B: redimensionarea nativă funcționează, compensarea CSS nu.
      // `possiblyResizeChildOfContent()` scrie `frameLayoutParams.height` pe
      // copilul lui android.R.id.content (Keyboard.java:151-168), adică pe
      // CoordinatorLayout-ul nostru → WebView-ul se micșorează → `100dvh`,
      // `innerHeight` și `visualViewport` scad TOATE corect, iar layout-ul flex
      // existent ridică composer-ul fără niciun px de padding adăugat din CSS.
      //
      // Obligatoriu: `--keyboard-inset` este 0 pe native (vezi styles.css),
      // altfel se revine exact la dubla compensare din build 21.
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
