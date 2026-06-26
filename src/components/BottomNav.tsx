import { Link, useLocation } from "@tanstack/react-router";
import { Compass, MessageCircle, CalendarHeart, Users, Trophy, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

export function BottomNav() {
  const { pathname } = useLocation();
  const { total: unreadTotal } = useUnreadMessages();
  const items = [
    { to: "/discover", label: "Discover", Icon: Compass },
    { to: "/nearby", label: "Nearby", Icon: MapPin },
    { to: "/quests", label: "Quests", Icon: Trophy },
    { to: "/events", label: "Events", Icon: CalendarHeart },
    { to: "/groups", label: "Squads", Icon: Users },
    { to: "/messages", label: "Messages", Icon: MessageCircle, badge: unreadTotal },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const { to, label, Icon } = item;
          const badge = "badge" in item ? item.badge : 0;
          const active = pathname === to || (to === "/events" && pathname.startsWith("/events")) || (to === "/groups" && pathname.startsWith("/groups")) || (to === "/messages" && pathname.startsWith("/messages")) || (to === "/quests" && pathname.startsWith("/quests")) || (to === "/nearby" && (pathname.startsWith("/nearby") || pathname.startsWith("/venues") || pathname.startsWith("/offers")));
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_var(--primary)]")} />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_8px_rgba(244,63,94,0.6)] ring-2 ring-background">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
