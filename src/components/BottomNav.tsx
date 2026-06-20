import { Link, useLocation } from "@tanstack/react-router";
import { Compass, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/discover", label: "Discover", Icon: Compass },
    { to: "/profile", label: "Profile", Icon: User },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around px-6 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_var(--primary)]")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
