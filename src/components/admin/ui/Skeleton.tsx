/** Skeleton primitives with shimmer, matching admin glass surface. */
export function SkeletonLine({ w = "100%", h = 12, className = "" }: { w?: string | number; h?: number; className?: string }) {
  return (
    <div
      className={`admin-shimmer rounded-md bg-surface-elevated/70 ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: h }}
    />
  );
}

export function SkeletonBlock({ h = 80, className = "" }: { h?: number; className?: string }) {
  return (
    <div className={`admin-shimmer rounded-2xl bg-surface-elevated/60 ${className}`} style={{ height: h }} />
  );
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface/40">
      <div className="grid gap-3 border-b border-border/60 px-4 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => <SkeletonLine key={i} h={10} w="60%" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3 border-b border-border/40 px-4 py-3 last:border-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} h={14} w={c === 0 ? "80%" : c === cols - 1 ? "40%" : "70%"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="admin-glass rounded-2xl p-4">
          <SkeletonLine w="40%" h={10} />
          <div className="mt-3"><SkeletonLine w="60%" h={22} /></div>
          <div className="mt-2"><SkeletonLine w="30%" h={9} /></div>
        </div>
      ))}
    </div>
  );
}
