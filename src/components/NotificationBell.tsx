import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/notifications-context";

export function NotificationBell({ className = "" }: { className?: string }) {
  const { unread } = useNotifications();
  return (
    <Link
      to="/notifications"
      className={`relative inline-flex items-center justify-center rounded-full p-2 text-muted-foreground hover:text-foreground ${className}`}
      aria-label="Notifications"
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-[0_0_8px_var(--primary)]">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
