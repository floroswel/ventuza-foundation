import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { linkOrphanBusinessApps } from "@/lib/business.functions";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const linkedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const maybeLinkBiz = (s: Session | null) => {
      const uid = s?.user?.id;
      if (!uid || linkedRef.current === uid) return;
      linkedRef.current = uid;
      // Fire-and-forget; safe if no orphan apps exist.
      // Never start another authenticated request synchronously inside
      // onAuthStateChange. The auth client still owns its internal lock there;
      // a nested getSession() can deadlock sign-in in a native WebView.
      window.setTimeout(() => {
        void linkOrphanBusinessApps().catch(() => {});
      }, 0);
      // Auto-redeem pending referral captured before sign-up
      try {
        const pending = localStorage.getItem("pending_ref");
        if (pending) {
          localStorage.removeItem("pending_ref");
          window.setTimeout(() => {
            void import("@/lib/referrals").then(({ redeemReferral }) =>
              redeemReferral(pending)
                .then((res) => {
                  if (res.ok) {
                    void import("sonner").then(({ toast }) =>
                      toast.success(`+${res.reward_xp ?? 100} XP de la prietenul tău!`),
                    );
                  }
                })
                .catch(() => {}),
            );
          }, 0);
        }
      } catch {
        /* ignore */
      }
    };

    // Listener first so we never miss an event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      setLoading(false);
      maybeLinkBiz(s);
    });

    // Then hydrate the current session. Native Preferences can occasionally be
    // slow on a cold WebView start; never keep the auth screen behind an
    // indefinite spinner while storage wakes up.
    const loadingGuard = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 1500);
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      window.clearTimeout(loadingGuard);
      setSession(data.session ?? null);
      setLoading(false);
      maybeLinkBiz(data.session);
    }).catch(() => {
      if (cancelled) return;
      window.clearTimeout(loadingGuard);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingGuard);
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          // Best-effort: drop the FCM row for the previous user on this device
          // BEFORE we invalidate the session, so shared devices don't keep
          // receiving pushes for the old account. Never blocks logout.
          try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
              const [{ teardownNativePush, readPersistedFcmToken }, { removeFcmSubscription }] =
                await Promise.all([
                  import("@/lib/native-push"),
                  import("@/lib/push.functions"),
                ]);
              const token = readPersistedFcmToken();
              await teardownNativePush({
                removeToken: async (t) => {
                  await removeFcmSubscription({ data: { token: t } });
                },
              }).catch(() => {});
              void token;
            }
          } catch {
            /* noop — logout must always proceed */
          }
          await supabase.auth.signOut();
          setSession(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
