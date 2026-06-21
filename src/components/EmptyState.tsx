import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Consistent gold-on-dark empty state with icon halo + optional CTA. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="relative mb-4">
        <span className="absolute inset-0 -m-3 rounded-full bg-primary/10 blur-xl" aria-hidden />
        <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30">
          <Icon className="size-7 text-primary" />
        </span>
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
