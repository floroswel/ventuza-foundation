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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-stretch justify-around pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
        {items.map(({ to, label, Icon, badge = 0, fillWhenActive }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              preload={false}
              className={cn(
                "group relative flex flex-1 flex-col items-center gap-1 px-1 py-1.5 transition-colors",
                active ? NAV_ICON_ACTIVE : cn(NAV_ICON_INACTIVE, "hover:text-foreground/80"),
              )}
              aria-current={active ? "page" : undefined}
            >
              {/* pastilă activă în spatele iconiței — coerent brand */}
              <span
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-2xl transition-all",
                  active && "bg-primary/10 ring-1 ring-primary/25",
                )}
              >
                <Icon
                  className={cn(NAV_ICON_SIZE, "transition-transform duration-200", active && "scale-105")}
                  strokeWidth={NAV_ICON_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={active && fillWhenActive ? "currentColor" : "none"}
                />
                {badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "font-display text-[10.5px] font-medium leading-none tracking-wide",
                  active ? "opacity-100" : "opacity-80",
                )}
              >
                {label}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-4 -top-px h-[2px] rounded-full bg-brand-gradient"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
