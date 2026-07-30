import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
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
            onClick={() => reset()}
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

/**
 * Preload-ul rutelor protejate (redirect în beforeLoad) poate produce în
 * router-core o respingere internă `Cannot read properties of undefined
 * (reading '_nonReactive')`. Nu afectează navigarea reală, dar ajungea la
 * error boundary și afișa „This page didn't load" (ex. pe /messages).
 */
function installPreloadRejectionGuard() {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { __suzetaPreloadGuard?: boolean };
  if (w.__suzetaPreloadGuard) return;
  w.__suzetaPreloadGuard = true;
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string; stack?: string } | undefined;
    const text = `${reason?.message ?? ""} ${reason?.stack ?? ""}`;
    if (text.includes("_nonReactive") || text.includes("preloadRoute")) {
      event.preventDefault();
    }
  });
}

export const getRouter = () => {
  installPreloadRejectionGuard();
  const queryClient = new QueryClient();


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Prefetch la hover (desktop) și la touchstart (mobile) — reduce latența
    // percepută la navigare fără a plăti cost până când userul arată intenția.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};

