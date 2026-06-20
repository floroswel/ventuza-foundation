import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  listNotifications,
  unreadCount as fetchUnreadCount,
  markAllRead as markAllReadApi,
  markRead as markReadApi,
  deleteNotification as deleteNotificationApi,
  type NotificationRow,
} from "@/lib/notifications";
import { toast } from "sonner";

type Ctx = {
  notifications: NotificationRow[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastToastIdRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnread(0);
      setLoading(false);
      return;
    }
    try {
      const [rows, count] = await Promise.all([listNotifications(50), fetchUnreadCount()]);
      setNotifications(rows);
      setUnread(count);
    } catch {
      // ignore — non-critical
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as NotificationRow;
          setNotifications((prev) => [n, ...prev].slice(0, 100));
          setUnread((c) => c + 1);
          // Toast preview, dedupe
          if (!lastToastIdRef.current.has(n.id)) {
            lastToastIdRef.current.add(n.id);
            toast(n.title, { description: n.body ?? undefined });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as NotificationRow;
          setNotifications((prev) => prev.map((x) => (x.id === n.id ? n : x)));
          // Recount
          fetchUnreadCount().then(setUnread).catch(() => {});
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const oldId = (payload.old as { id: string }).id;
          setNotifications((prev) => prev.filter((x) => x.id !== oldId));
          fetchUnreadCount().then(setUnread).catch(() => {});
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = useCallback(async () => {
    await markAllReadApi();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnread(0);
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    await markReadApi(ids);
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    setUnread((c) => Math.max(0, c - ids.length));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteNotificationApi(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value = useMemo(
    () => ({ notifications, unread, loading, refresh, markAllRead, markRead, remove }),
    [notifications, unread, loading, refresh, markAllRead, markRead, remove],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
