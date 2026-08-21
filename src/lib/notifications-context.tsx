import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { saveFcmSubscription, savePushSubscription } from "@/lib/push.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  listNotifications,
  unreadCount as fetchUnreadCount,
  markAllRead as markAllReadApi,
  markRead as markReadApi,
  deleteNotification as deleteNotificationApi,
  BELL_TYPES,
  type NotificationRow,
} from "@/lib/notifications";
import { conversationIdFromLink, isViewingConversation } from "@/lib/active-conversation";
import { toast } from "sonner";
import {
  playNotificationSound,
  primeNotificationSound,
} from "@/lib/notification-sound";
import { setNativePushNavigator } from "@/lib/native-push";
import { buildToastBody } from "@/lib/notification-privacy";
import { useNotificationPrefs } from "@/lib/notification-prefs-context";
import { uniqueRealtimeTopic } from "@/lib/realtime-topic";

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
  const { prefs } = useNotificationPrefs();
  const showPreview = prefs.show_preview;
  const showPreviewRef = useRef(showPreview);
  useEffect(() => {
    showPreviewRef.current = showPreview;
  }, [showPreview]);
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

  // Prime AudioContext on first user gesture (iOS/Safari requirement)
  useEffect(() => {
    primeNotificationSound();
  }, []);

  // Wire the native-push tap navigator (no-op on the web).
  const navigate = useNavigate();
  useEffect(() => {
    setNativePushNavigator((path) => {
      navigate({ to: path }).catch(() => {
        // path may not be typed as a known route; fall back to window
        if (typeof window !== "undefined") window.location.assign(path);
      });
    });
  }, [navigate]);

  /**
   * Reluăm push-ul nativ la fiecare pornire, pentru utilizatorii care l-au
   * activat deja. NU cere permisiunea — dacă nu e acordată, iese tăcut.
   *
   * Fără asta, ascultătorii trăiau doar în sesiunea în care s-a apăsat butonul
   * „Activează”: la un cold start, un tap pe notificare deschidea aplicația pe
   * ecranul principal în loc de conversație, iar un token rotit de FCM nu mai
   * ajungea niciodată în `push_subscriptions`.
   */
  const saveFcm = useServerFn(saveFcmSubscription);
  const saveWebPush = useServerFn(savePushSubscription);
  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const { resumeNativePush } = await import("@/lib/native-push");
        await resumeNativePush({
          saveToken: async (token) => {
            await saveFcm({
              data: {
                token,
                platform: "android",
                userAgent:
                  typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 500),
              },
            });
          },
        });
      } catch (e) {
        console.warn("[notifications] resumeNativePush failed", e);
      }
      // Web: re-salvăm abonamentul push la fiecare start (permisiune deja
      // acordată), ca notificările să sosească și cu aplicația închisă.
      try {
        const { resumeWebPush } = await import("@/lib/web-push-resume");
        await resumeWebPush((d) => saveWebPush({ data: d }));
      } catch (e) {
        console.warn("[notifications] resumeWebPush failed", e);
      }
    })();
  }, [user, saveFcm, saveWebPush]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(uniqueRealtimeTopic(`notifications:${user.id}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          const isMessage = n.type === "message";
          // Clopoțelul = doar vizite de profil. Mesajele nu intră în listă
          // și nu cresc badge-ul — ele trăiesc în tab-ul Mesaje.
          if (BELL_TYPES.includes(n.type)) {
            setNotifications((prev) => [n, ...prev].slice(0, 100));
            setUnread((c) => c + 1);
          }
          if (lastToastIdRef.current.has(n.id)) return;
          lastToastIdRef.current.add(n.id);
          // Dacă userul este deja în conversația respectivă: doar sunet,
          // fără toast (mesajul apare oricum în thread).
          const inThisChat =
            isMessage && isViewingConversation(conversationIdFromLink(n.link));
          if (!inThisChat) {
            toast(n.title, {
              description: buildToastBody(showPreviewRef.current, n.body, n.type),
            });
          }
          playNotificationSound();
        },

      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          setNotifications((prev) => prev.map((x) => (x.id === n.id ? n : x)));
          // Recount
          fetchUnreadCount()
            .then(setUnread)
            .catch(() => {});
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldId = (payload.old as { id: string }).id;
          setNotifications((prev) => prev.filter((x) => x.id !== oldId));
          fetchUnreadCount()
            .then(setUnread)
            .catch(() => {});
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = useCallback(async () => {
    await markAllReadApi();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    );
    setUnread(0);
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    await markReadApi(ids);
    setNotifications((prev) =>
      prev.map((n) =>
        ids.includes(n.id) && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n,
      ),
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

/** Safe fallback — if the provider isn't mounted (e.g. crash in tree above),
 *  the page renders empty notifications instead of crashing the whole route. */
const EMPTY_CTX: Ctx = {
  notifications: [],
  unread: 0,
  loading: false,
  refresh: async () => {},
  markAllRead: async () => {},
  markRead: async () => {},
  remove: async () => {},
};

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    if (typeof console !== "undefined")
      console.warn("[notifications] provider missing — using empty fallback");
    return EMPTY_CTX;
  }
  return ctx;
}
