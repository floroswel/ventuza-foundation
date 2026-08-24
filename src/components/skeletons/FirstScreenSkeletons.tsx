import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton-uri pentru primul ecran.
 *
 * Regula: forma skeleton-ului trebuie să fie IDENTICĂ cu layoutul real
 * (aceleași grile, aceleași înălțimi), altfel conținutul „sare" la sosirea
 * datelor și pierdem exact fluiditatea pe care o urmărim. De aceea grila
 * folosește `grid-cols-3 gap-[1px]` și `aspect-square`, ca `Cascade`, iar
 * lista de conversații are aceeași înălțime de rând ca linkul real.
 */

/** Rândul orizontal „Online acum" din Discover. */
export function OnlineRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden px-4 py-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex shrink-0 flex-col items-center gap-1.5">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-2.5 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Grila principală de profiluri (3 coloane, pătrate). */
export function DiscoverGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-[1px] bg-border/40" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative aspect-square overflow-hidden bg-surface">
          <Skeleton className="size-full rounded-none" />
          <div className="absolute inset-x-1.5 bottom-1.5 space-y-1">
            <Skeleton className="h-2.5 w-2/3 rounded bg-black/30 ring-0" />
            <Skeleton className="h-2 w-1/3 rounded bg-black/30 ring-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Primul ecran Discover complet: rând online + grilă. */
export function DiscoverSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă profilurile">
      <OnlineRowSkeleton />
      <div className="px-4 pb-1 pt-4">
        <Skeleton className="h-2.5 w-24 rounded" />
      </div>
      <DiscoverGridSkeleton />
      <span className="sr-only">Se încarcă profilurile din apropiere…</span>
    </div>
  );
}

/** Lista de conversații / interese din Mesaje. */
export function ConversationListSkeleton({ count = 7 }: { count?: number }) {
  return (
    <ul
      className="divide-y divide-border/30"
      role="status"
      aria-label="Se încarcă conversațiile"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3 rounded" />
            <Skeleton className="h-2.5 w-2/3 rounded" />
          </div>
          <Skeleton className="h-2.5 w-8 shrink-0 rounded" />
        </li>
      ))}
      <span className="sr-only">Se încarcă conversațiile…</span>
    </ul>
  );
}
