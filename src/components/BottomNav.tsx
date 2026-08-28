import { Link, useLocation } from "@tanstack/react-router";
import { Compass, Sparkles, Heart, MessageCircle, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

// Tokeni unificați pentru iconițele de navigație — rounded, aceeași mărime,
// aceleași culori pentru activ / inactiv. Folosiți și în alte bare cheie
// (Settings, Admin shell) pentru a păstra coerența vizuală.
export const NAV_ICON_SIZE = "size-[22px]";
export const NAV_ICON_STROKE = 1.75;
export const NAV_ICON_ACTIVE = "text-foreground";
export const NAV_ICON_INACTIVE = "text-muted-foreground";

type NavItem = {
  to: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
  fillWhenActive?: boolean;
};

export function BottomNav() {
  const { pathname } = useLocation();
  const { total: unreadTotal } = useUnreadMessages();

  const items: NavItem[] = [
    { to: "/discover", label: "Suzeta", Icon: Compass },
    { to: "/nearby", label: "Descoperă", Icon: Sparkles },
    { to: "/matches", label: "Potriviri", Icon: Heart, fillWhenActive: true },
    { to: "/messages", label: "Mesaje", Icon: MessageCircle, badge: unreadTotal, fillWhenActive: true },
    { to: "/profile", label: "Profil", Icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-stretch justify-around pt-1 pb-[max(0.375rem,var(--safe-bottom))] pl-[max(0.25rem,var(--safe-left))] pr-[max(0.25rem,var(--safe-right))]">
        {items.map(({ to, label, Icon, badge = 0, fillWhenActive }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              preload={false}
              className={cn(
                "group relative flex flex-1 flex-col items-center gap-0.5 px-1 py-1.5 transition-colors",
                active ? "text-primary" : cn(NAV_ICON_INACTIVE, "hover:text-foreground/80"),
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative flex h-7 items-center justify-center">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-[-10px] inset-y-[-3px] rounded-full transition-all duration-200",
                    active ? "bg-primary/12 opacity-100" : "opacity-0",
                  )}
                />
                <Icon
                  className={cn("relative", NAV_ICON_SIZE, "transition-transform duration-150", active && "scale-105")}
                  strokeWidth={active ? 2 : NAV_ICON_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={active && fillWhenActive ? "currentColor" : "none"}
                />

                {badge > 0 && (
                  <span className="absolute -right-2 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none tracking-tight",
                  active ? "font-semibold opacity-100" : "font-medium opacity-75",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

