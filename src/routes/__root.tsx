import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { Toaster } from "sonner";
import { CookieBanner } from "@/components/CookieBanner";
import { TravelWarning } from "@/components/TravelWarning";
import { PinLockGate } from "@/components/PinLockGate";
import { SessionGuards } from "@/components/SessionGuards";
import { AgeGate } from "@/components/AgeGate";
import { QuickExitFab } from "@/components/QuickExitFab";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
      { name: "theme-color", content: "#0E0D0B" },
      { title: "Ventuza — Dating, elevated." },
      { name: "description", content: "Ventuza is a premium, inclusive dating experience. Meet people who match your depth." },
      { property: "og:title", content: "Ventuza — Dating, elevated." },
      { property: "og:description", content: "Ventuza is a premium, inclusive dating experience. Meet people who match your depth." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Ventuza — Dating, elevated." },
      { name: "twitter:description", content: "Ventuza is a premium, inclusive dating experience. Meet people who match your depth." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/14c4abb2-308d-4a85-8862-ba47e7f22abd/id-preview-e4594ec3--31f90140-a9a7-481a-b09d-ae4df6103241.lovable.app-1781988056548.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/14c4abb2-308d-4a85-8862-ba47e7f22abd/id-preview-e4594ec3--31f90140-a9a7-481a-b09d-ae4df6103241.lovable.app-1781988056548.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Initialize i18n (auto-detects RO/EN from localStorage > navigator).
    void import("@/lib/i18n").then((mod) => {
      document.documentElement.lang = mod.default.language || "ro";
    });

    // Re-apply discreet mode (icon/title swap) chosen by user on previous session.
    import("@/lib/discreet-mode").then(({ loadDiscreetMode, applyDiscreetMode }) => {
      const skin = loadDiscreetMode();
      if (skin !== "off") applyDiscreetMode(skin);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>
          <SessionGuards />
          <Outlet />
          <AgeGate />
          <CookieBanner />
          <TravelWarning />
          <PinLockGate />
          <Toaster theme="dark" position="top-center" richColors />
          <QuickExitFab />
        </NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

