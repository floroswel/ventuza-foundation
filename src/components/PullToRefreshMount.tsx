import { useEffect, useRef, useState } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Pull-to-refresh nativ: glisare de sus în jos (când ecranul e la vârful
 * scroll-ului) → indicator + reîmprospătare completă:
 *  1. invalidează toate query-urile TanStack Query (datele paginii curente),
 *  2. re-rulează loader-ele de rută (router.invalidate),
 *  3. verifică dacă există o versiune nouă în Google Play → bannerul
 *     `UpdateAvailableBanner` apare forțat dacă da.
 *
 * Funcționează DOAR pe touch (telefon). Pe desktop nu interferează cu
 * mouse-ul. Nu se activează în interiorul listelor cu scroll orizontal sau
 * pe rutele de admin.
 */
const PULL_THRESHOLD = 72; // px de tras până declanșăm refresh-ul
const MAX_PULL = 110;

export function PullToRefreshMount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;

    function findScroller(el: EventTarget | null): Element | null {
      let node = el instanceof Element ? el : null;
      while (node) {
        const style = window.getComputedStyle(node);
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return document.scrollingElement;
    }

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      const scroller = findScroller(e.target);
      const atTop = !scroller || scroller.scrollTop <= 0;
      startY.current = atTop ? e.touches[0].clientY : null;
      pulling.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pulling.current) {
          pulling.current = false;
          setPull(0);
        }
        return;
      }
      const scroller = findScroller(e.target);
      if (scroller && scroller.scrollTop > 0) return;
      pulling.current = true;
      // Rezistență logaritmică — senzație nativă, nu 1:1.
      setPull(Math.min(MAX_PULL, Math.round(dy * 0.45)));
    };

    const finish = async () => {
      if (!pulling.current) {
        startY.current = null;
        return;
      }
      const shouldRefresh = pull >= PULL_THRESHOLD;
      pulling.current = false;
      startY.current = null;
      setPull(0);
      if (!shouldRefresh) return;

      setRefreshing(true);
      try {
        // 1) datele paginii curente
        await queryClient.invalidateQueries();
        // 2) loader-ele de rută
        await router.invalidate();
        // 3) verificare update Play Store (forțată — userul a cerut explicit)
        const { requestUpdateCheck } = await import("@/lib/app-update");
        requestUpdateCheck(true);
      } catch {
        /* offline — tăcem, offline banner-ul există deja */
      } finally {
        // Mic delay ca indicatorul să nu dispară brusc.
        setTimeout(() => setRefreshing(false), 350);
      }
    };

    const onTouchEnd = () => void finish();

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [location.pathname, pull, refreshing, queryClient, router]);

  if (location.pathname.startsWith("/admin")) return null;

  const visible = refreshing || pull > 8;
  const height = refreshing ? 44 : pull;
  const progress = Math.min(1, (refreshing ? PULL_THRESHOLD : pull) / PULL_THRESHOLD);

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 top-0 z-[95] flex justify-center overflow-hidden pt-safe transition-[height] duration-150"
      style={{ height: visible ? `calc(${height}px + env(safe-area-inset-top, 0px))` : 0 }}
    >
      <div
        className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-md"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" strokeDasharray={`${progress * 42} 100`} />
          <path d="M21 3v5h-5" />
        </svg>
      </div>
    </div>
  );
}
