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
    <nav className="fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(0.5rem,var(--safe-bottom))] pt-1">
      <div className="mx-auto flex max-w-md items-stretch gap-1 rounded-[26px] border border-border/70 bg-surface/95 p-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        {items.map(({ to, label, Icon, badge = 0, fillWhenActive }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              preload={false}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-2 transition-colors duration-150",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_hsl(var(--primary))]"
                  : cn(NAV_ICON_INACTIVE, "hover:text-foreground/80 active:bg-muted/40"),
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative flex items-center justify-center">
                <Icon
                  className={NAV_ICON_SIZE}
                  strokeWidth={active ? 2.2 : NAV_ICON_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={active && fillWhenActive ? "currentColor" : "none"}
                />
                {badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-surface">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none tracking-tight",
                  active ? "font-semibold" : "font-medium opacity-80",
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

