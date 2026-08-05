import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installChunkRecovery, isStaleChunkError, recoverFromStaleChunk } from "@/lib/chunk-recovery";
import { enforceCanonicalHost } from "@/lib/canonical-origin";

import { AuthProvider } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { NotificationPrefsProvider } from "@/lib/notification-prefs-context";
import { Toaster } from "sonner";
import { CookieBanner } from "@/components/CookieBanner";
import { TravelWarning } from "@/components/TravelWarning";
import { PinLockGate } from "@/components/PinLockGate";
import { SessionGuards } from "@/components/SessionGuards";
import { GuardianBoundary } from "@/components/GuardianBoundary";

import { CountryRiskGuard } from "@/components/CountryRiskGuard";
import { AgeGate } from "@/components/AgeGate";
import { useProximityForegroundWatcher } from "@/lib/proximity-watcher";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useLocationWatcher } from "@/hooks/useLocationWatcher";
// Init i18n eagerly — useTranslation() în orice rută/child are nevoie de
// instanță înainte de prima randare (altfel NO_I18NEXT_INSTANCE).
import "@/lib/i18n";


import { ConsentPromptHost } from "@/components/ConsentPromptHost";
import { VersionGate } from "@/components/VersionGate";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DebugPanel } from "@/components/DebugPanel";
import { OfflineBanner } from "@/components/OfflineBanner";
import { LocationPermissionPrompt } from "@/components/LocationPermissionPrompt";
import { NativePushNavigatorMount } from "@/components/NativePushNavigatorMount";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    // Chunk vechi după o publicare nouă → curățăm cache-ul și reîncărcăm
    // automat (o singură dată), fără să mai afișăm eroarea utilizatorului.
    if (isStaleChunkError(error)) {
      void recoverFromStaleChunk();
      return;
    }
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    void import("@/lib/crash-log").then(({ logCrash }) =>
      logCrash({
        kind: "boundary",
        boundary: "tanstack_root_error_component",
        message: error.message,
        stack: error.stack,
      }),
    );
  }, [error]);


  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0B0B10" },
      {
        name: "google-site-verification",
        content: "n4fIK6zXH2jNBMKgucU2XEu_tNEE5JpPxNdfDyEIFR4",
      },
      { title: "Suzeta — Dating, elevated." },
      {
        name: "description",
        content:
          "Suzeta is a premium, inclusive dating experience. Meet people who match your depth.",
      },
      { property: "og:title", content: "Suzeta — Dating, elevated." },
      {
        property: "og:description",
        content:
          "Suzeta is a premium, inclusive dating experience. Meet people who match your depth.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Suzeta — Dating, elevated." },
      {
        name: "twitter:description",
        content:
          "Suzeta is a premium, inclusive dating experience. Meet people who match your depth.",
      },
      { property: "og:site_name", content: "Suzeta" },
      { property: "og:locale", content: "ro_RO" },
      { property: "og:locale:alternate", content: "en_US" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", sizes: "48x48", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon.png" },
      { rel: "shortcut icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },


      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Wrapper de tranziție între ecrane — animație scurtă la fiecare schimbare de
 * rută, cu fundal opac ca să nu existe flash alb (comportament de browser).
 */
function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}

function ProximityWatcherMount() {
  useProximityForegroundWatcher();
  usePresenceHeartbeat();
  useLocationWatcher();
  return null;
}

function LocationPermissionPromptMount() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin")) return null;
  return <LocationPermissionPrompt />;
}

/** Anti-screenshot: blocat pe conținut privat, permis pe ecranele publice. */
function ScreenSecurityMount() {
  const location = useLocation();
  useEffect(() => {
    void import("@/lib/native-screen-security").then(({ applyScreenshotPolicy }) =>
      applyScreenshotPolicy(location.pathname),
    );
  }, [location.pathname]);
  return null;
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();


  useEffect(() => {
    // i18n e deja inițializat de import eager; aici doar setăm <html lang>.
    void import("@/lib/i18n").then((mod) => {
      document.documentElement.lang = mod.default.language || "ro";
    });

    // Privacy screen: ecranul din multitasking/recents este ascuns.
    void import("@capacitor-community/privacy-screen")
      .then(({ PrivacyScreen }) => PrivacyScreen.enable())
      .catch(() => undefined);




    // Re-apply discreet mode (icon/title swap) chosen by user on previous session.
    import("@/lib/discreet-mode").then(({ loadDiscreetMode, applyDiscreetMode }) => {
      const skin = loadDiscreetMode();
      if (skin !== "off") applyDiscreetMode(skin);
    });
    // Web Vitals → DB — only after analytics consent
    const maybeInitVitals = () => {
      try {
        let raw = localStorage.getItem("suzeta_cookie_consent_v2");
        if (!raw) {
          const legacy = localStorage.getItem("ventuza_cookie_consent_v2");
          if (legacy) {
            localStorage.setItem("suzeta_cookie_consent_v2", legacy);
            localStorage.removeItem("ventuza_cookie_consent_v2");
            raw = legacy;
          }
        }
        if (!raw) return;
        const c = JSON.parse(raw);
        if (c?.analytics) {
          import("@/lib/web-vitals").then(({ initWebVitals }) => initWebVitals());
        }
      } catch {
        /* ignore */
      }
    };
    maybeInitVitals();
    const onConsent = () => maybeInitVitals();
    window.addEventListener("suzeta:consent", onConsent);
    // Capture ?ref=CODE on first load for later redemption after sign-up
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (ref && !localStorage.getItem("pending_ref")) {
        localStorage.setItem("pending_ref", ref.toUpperCase());
      }
    } catch {
      /* ignore */
    }
    return () => window.removeEventListener("suzeta:consent", onConsent);
  }, []);

  useEffect(() => {
    // Forțează domeniul canonic (suzeta.app) — altfel OAuth pleacă cu ventuza.app.
    enforceCanonicalHost();
    // Recuperare automată din chunk-uri vechi după o publicare nouă.
    installChunkRecovery();
    // Global crash logger (device local, ring buffer 50).
    void import("@/lib/crash-log").then(({ installGlobalCrashHandlers }) =>
      installGlobalCrashHandlers(),
    );
    // SUZETA AUTONOMOUS APP GUARDIAN — monitorizare permanentă + auto-reparare
    // sigură (erori JS/React/promise, rețea, sesiune, media, rute).
    void import("@/lib/guardian/collector").then(({ installGuardian }) => installGuardian());


    // Guarded PWA registration (dev/preview/iframe/?sw=off all refuse).
    void import("@/lib/pwa-register").then(({ registerPwa }) => registerPwa());
    // Native Android runtime: back button, keyboard resize, status bar.
    void import("@/lib/native-runtime").then(({ bootstrapNativeRuntime }) =>
      bootstrapNativeRuntime(router),
    );
  }, [router]);

  useEffect(() => {
    // Offline persist pentru TanStack Query (allowlist, 24h, buster = APP_VERSION).
    let cleanup: (() => void) | null = null;
    void import("@/lib/query-persister").then(({ setupQueryPersistence }) => {
      cleanup = setupQueryPersistence(queryClient);
    });
    // Outbox mesaje offline — auto-flush la reconectare.
    void import("@/lib/message-outbox")
      .then((module) => {
        if (typeof module?.wireOutboxAutoFlush === "function") {
          module.wireOutboxAutoFlush();
        }
      })
      .catch((error) => {
        console.warn("[outbox] inițializarea automată nu este disponibilă", error);
      });
    return () => {
      cleanup?.();
    };
  }, [queryClient]);



  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>

        <NotificationPrefsProvider>
          <NotificationsProvider>
            <SessionGuards />
            <CountryRiskGuard />
            <ProximityWatcherMount />
            <ScreenSecurityMount />
            <NativePushNavigatorMount />
            <GuardianBoundary area="app" category="react">
              <PageTransition>
                <Outlet />
              </PageTransition>
            </GuardianBoundary>

            <OfflineBanner />
            <LocationPermissionPromptMount />
            <AgeGate />
            <CookieBanner />
            <TravelWarning />
            <PinLockGate />
            <Toaster theme="dark" position="top-center" richColors />

            <LanguageToggle />
            <ConsentPromptHost />
            <VersionGate />
            <DebugPanel />
          </NotificationsProvider>
        </NotificationPrefsProvider>
      </AuthProvider>
    </QueryClientProvider>
    </LazyMotion>

  );
}

