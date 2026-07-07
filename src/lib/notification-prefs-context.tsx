/**
 * Sursa unică pentru preferințele de notificări + confidențialitate ale
 * userului curent. Se hidratează IMEDIAT la login și se actualizează în
 * timp real pentru toate suprafețele (inbox, toast, settings) prin:
 *
 *   1. Fetch inițial cât timp `user` există.
 *   2. Subscribție Supabase Realtime pe `profiles` (postgres_changes UPDATE
 *      filtrat pe `id=eq.<uid>`) — orice schimbare în alt tab/device se
 *      propagă instant.
 *   3. `updatePrefs(patch)` — update optimistic în context + persist în DB,
 *      cu rollback dacă serverul respinge.
 *
 * Consumers (settings, messages.index, notifications-context) citesc DOAR
 * prin `useNotificationPrefs()`. Nimeni nu face fetch propriu.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type NotificationPrefs = {
  matches: boolean;
  messages: boolean;
  likes: boolean;
  taps: boolean;
  events: boolean;
  marketing: boolean;
  master_push: boolean;
  quiet_enabled: boolean;
  quiet_start: number;
  quiet_end: number;
  /**
   * Toggle-ul de „arată conținut în notificări". Policy curent: filtrul
   * central îl ignoră (body-ul rămâne generic), dar toggle-ul rămâne în UI
   * ca preferință a userului și e propagat sincron pentru viitoare canale
   * care ar putea beneficia (ex. email opt-in, tag semantic).
   */
  show_preview: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  matches: true,
  messages: true,
  likes: true,
  taps: true,
  events: true,
  marketing: false,
  master_push: true,
  quiet_enabled: false,
  quiet_start: 23,
  quiet_end: 7,
  show_preview: false,
};

type Ctx = {
  prefs: NotificationPrefs;
  discreteMode: boolean;
  loading: boolean;
  /**
   * Update optimistic: aplică local instant, persistă în DB, rollback la
   * eroare. Reflectă imediat în toți consumers (inbox + toast + settings).
   */
  updatePrefs: (patch: Partial<NotificationPrefs>) => Promise<void>;
  setDiscreteMode: (v: boolean) => Promise<void>;
};

const NotificationPrefsContext = createContext<Ctx | null>(null);

export function NotificationPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [discreteMode, setDiscreteModeState] = useState(false);
  const [loading, setLoading] = useState(true);
  const prefsRef = useRef(prefs);
  const discreteRef = useRef(discreteMode);
  prefsRef.current = prefs;
  discreteRef.current = discreteMode;

  // Fetch inițial la fiecare (re)logare.
  useEffect(() => {
    if (!user) {
      setPrefs(DEFAULT_NOTIFICATION_PREFS);
      setDiscreteModeState(false);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    void supabase
      .from("profiles")
      .select("notification_prefs, discrete_mode")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const raw = (data as { notification_prefs?: Partial<NotificationPrefs> } | null)
          ?.notification_prefs;
        if (raw) setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...raw });
        setDiscreteModeState(
          !!(data as { discrete_mode?: boolean } | null)?.discrete_mode,
        );
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  // Realtime: orice UPDATE pe profilul meu (alt tab, alt device, admin) →
  // sincronizare instantă în toate suprafețele.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`prefs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            notification_prefs?: Partial<NotificationPrefs> | null;
            discrete_mode?: boolean | null;
          };
          if (row.notification_prefs) {
            setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...row.notification_prefs });
          }
          if (typeof row.discrete_mode === "boolean") {
            setDiscreteModeState(row.discrete_mode);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const updatePrefs = useCallback<Ctx["updatePrefs"]>(
    async (patch) => {
      if (!user) return;
      const previous = prefsRef.current;
      const next = { ...previous, ...patch };
      setPrefs(next); // optimistic
      const { error } = await supabase
        .from("profiles")
        .update({ notification_prefs: next })
        .eq("id", user.id);
      if (error) {
        setPrefs(previous); // rollback
        throw error;
      }
    },
    [user],
  );

  const setDiscreteMode = useCallback<Ctx["setDiscreteMode"]>(
    async (v) => {
      if (!user) return;
      const previous = discreteRef.current;
      setDiscreteModeState(v);
      const { error } = await supabase
        .from("profiles")
        .update({ discrete_mode: v })
        .eq("id", user.id);
      if (error) {
        setDiscreteModeState(previous);
        throw error;
      }
    },
    [user],
  );

  const value = useMemo<Ctx>(
    () => ({ prefs, discreteMode, loading, updatePrefs, setDiscreteMode }),
    [prefs, discreteMode, loading, updatePrefs, setDiscreteMode],
  );

  return (
    <NotificationPrefsContext.Provider value={value}>
      {children}
    </NotificationPrefsContext.Provider>
  );
}

export function useNotificationPrefs(): Ctx {
  const ctx = useContext(NotificationPrefsContext);
  if (!ctx) {
    // Fallback silențios pentru rutele care s-ar putea randa în afara
    // provider-ului (ex. teste). Consumer-ul primește default-uri.
    return {
      prefs: DEFAULT_NOTIFICATION_PREFS,
      discreteMode: false,
      loading: false,
      updatePrefs: async () => {},
      setDiscreteMode: async () => {},
    };
  }
  return ctx;
}
