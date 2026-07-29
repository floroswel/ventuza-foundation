import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * SUZETA empty state — brand gradient halo, refined typography and spacing.
 * Consistent across every screen (Discover, Chats, Matches, Admin, etc.).
 */
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
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-5">
        {/* Soft brand halo */}
        <span
          className="pointer-events-none absolute inset-0 -m-6 rounded-full opacity-70 blur-2xl bg-brand-gradient"
          aria-hidden
        />
        {/* Gradient ring with dark inner disc */}
        <span className="relative inline-flex size-20 items-center justify-center rounded-full p-[1.5px] bg-brand-gradient">
          <span className="flex size-full items-center justify-center rounded-full bg-card">
            <Icon className="size-8 text-foreground" strokeWidth={1.75} />
          </span>
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {body && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
