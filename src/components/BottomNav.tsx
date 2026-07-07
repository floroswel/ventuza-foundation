import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

// Custom line-art icons matching the Ventuza brand strip

function VentuzaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      {/* crown */}
      <path
        d="M9 7 L12 10 L16 6 L20 10 L23 7 L22 12 L10 12 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* V */}
      <path
        d="M10 14 L16 26 L22 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M8 12 L12 6 L20 6 L24 12 L16 26 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 12 L24 12 M12 6 L16 12 L20 6 M12 12 L16 26 L20 12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M16 26 C 6 19 6 11 11 9 C 14 8 16 10 16 12 C 16 10 18 8 21 9 C 26 11 26 19 16 26 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatBubbleIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M6 14 C 6 8 11 6 16 6 C 22 6 26 10 26 15 C 26 20 22 24 16 24 L 12 24 L 8 27 L 9 22 C 7 20 6 17 6 14 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <circle cx="16" cy="11" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7 26 C 8 20 12 18 16 18 C 20 18 24 20 25 26"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  const { total: unreadTotal } = useUnreadMessages();

  const items = [
    { to: "/discover", label: "Ventuza", Icon: VentuzaMark },
    { to: "/nearby", label: "Descoperă", Icon: DiamondIcon },
    { to: "/matches", label: "Potriviri", Icon: HeartIcon },
    { to: "/messages", label: "Mesaje", Icon: ChatBubbleIcon, badge: unreadTotal, filledWhenActive: true },
    { to: "/profile", label: "Profil", Icon: PersonIcon },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-primary/20 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const { to, label, Icon } = item;
          const badge = "badge" in item ? item.badge : 0;
          const filledWhenActive = "filledWhenActive" in item ? item.filledWhenActive : false;
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1.5 px-1 py-1 transition-colors",
                active ? "text-primary" : "text-primary/60 hover:text-primary/90",
              )}
            >
              <span className="relative">
                <Icon
                  className={cn(
                    "size-7",
                    active && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]",
                  )}
                  {...(filledWhenActive ? { filled: active } : {})}
                />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-background">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span className="font-serif text-[13px] leading-none tracking-wide">
                {label}
              </span>
              {active && (
                <span className="absolute -top-[1px] h-[2px] w-8 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
