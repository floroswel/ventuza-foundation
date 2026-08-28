import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installNativeApiOrigin } from "./lib/native-api-origin";

// Nativ (Capacitor): rescrie `/_serverFn` și `/api/` către originul de producție.
installNativeApiOrigin();

function DefaultPendingComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div
        aria-label="Se încarcă"
        role="status"
        className="size-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
      />
    </div>
  );
}

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
  // Cache agresiv dar sigur: datele rămân „proaspete" 60s, deci re-montarea
  // unei rute (navigare înainte/înapoi, tab switch) nu re-cere nimic.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
        retry: 1,
        networkMode: "offlineFirst",
      },
    },
  });

  // Restaurarea cache-ului pornește AICI, la crearea clientului, nu dintr-un
  // `useEffect` din __root.tsx.
  //
  // Varianta veche plătea, în ordine: prima randare → efect → `await import`
  // al modulului de persistență → abia apoi citirea din storage. Pe nativ,
  // storage-ul este Capacitor Preferences (asincron), deci datele soseau cu
  // mult după primul cadru: utilizatorul vedea spinner, iar lista lui de
  // conversații — deja pe disc — apărea vizibil mai târziu.
  //
  // Pornită de la crearea router-ului, citirea se suprapune cu randarea
  // shell-ului și cu hidratarea, în loc să se așeze după ele. Import static,
  // intenționat: un `await import` aici ar reintroduce chiar întârzierea pe
  // care o eliminăm.
  //
  // Import DINAMIC, dar pornit imediat, nu dintr-un efect React: cererea pleacă
  // în paralel cu restul pornirii, iar modulul nu intră în chunk-ul principal
  // (care e deja peste buget). Un import static ar fi adăugat persisterul și
  // dependențele lui la octeții parsați înainte de primul pixel.
  void import("./lib/query-persister")
    .then(({ setupQueryPersistence }) => setupQueryPersistence(queryClient))
    .catch((e) => {
      // Storage blocat (mod privat, cotă plină) nu are voie să oprească
      // pornirea: aplicația funcționează la fel, doar fără cache pe disc.
      console.warn("[router] persistența cache-ului nu a putut porni", e);
    });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Prefetch la hover (desktop) și la touchstart (mobile) — reduce latența
    // percepută la navigare fără a plăti cost până când userul arată intenția.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 30_000,
    defaultErrorComponent: DefaultErrorComponent,
    // Nicio ecran alb la navigare: dacă o rută lazy întârzie >150ms afișăm un
    // indicator nativ, minim 300ms ca să nu clipească.
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    defaultPendingComponent: DefaultPendingComponent,
  });

  return router;
};

