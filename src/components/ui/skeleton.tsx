import { cn } from "@/lib/utils";

/**
 * Skeleton — SUZETA brand loader.
 * Subtle surface base + slow brand-gradient shimmer sweep.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface/70 ring-1 ring-border",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-[linear-gradient(110deg,transparent_20%,rgba(229,72,255,0.10)_45%,rgba(6,214,214,0.10)_55%,transparent_80%)]",
        "before:animate-[skeleton-shimmer_1.6s_ease-in-out_infinite]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
