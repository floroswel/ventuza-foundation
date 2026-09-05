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
  // Fast path: dacă sesiunea e deja pe device și validă, pornim direct logat.
  // Fără asta, aplicația stă pe splash până răspunde bridge-ul nativ / rețeaua.
  const cached = useRef<Session | null>(null);
  if (cached.current === null && typeof window !== "undefined") {
    cached.current = readCachedSession();
  }
  const [session, setSession] = useState<Session | null>(cached.current);
  const [loading, setLoading] = useState(!cached.current);
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
      // Un eveniment fără sesiune la boot NU înseamnă "delogat": poate fi
      // INITIAL_SESSION emis înainte ca storage-ul nativ să răspundă.
      // Ridicăm ecranul de încărcare doar când avem sesiune sau când
      // bootstrap-ul (inclusiv recuperarea nativă) s-a încheiat.
      if (s) setLoading(false);
      maybeLinkBiz(s);
    });

    // Bootstrap-ul sesiunii. Pe nativ, bridge-ul Capacitor poate răspunde în
    // câteva secunde la primul cold start de după un update din Play Store;
    // dacă declarăm prematur "fără sesiune", userul vede ecranul de Login deși
    // refresh tokenul lui este valid.
    const native = (() => {
      try {
        const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
          .Capacitor;
        return !!cap?.isNativePlatform?.();
      } catch {
        return false;
      }
    })();
    // Plafon absolut: aplicația nu rămâne niciodată blocată pe splash.
    const loadingGuard = window.setTimeout(
      () => {
        if (!cancelled) setLoading(false);
      },
      native ? 9_000 : 2_500,
    );
    const withTimeout = <T,>(p: Promise<T>, ms: number) =>
      Promise.race([
        p,
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("auth_bootstrap_timeout")), ms);
        }),
      ]);

    void (async () => {
      let restored: Session | null = null;
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), native ? 7_000 : 5_000);
        restored = data.session ?? null;
      } catch {
        restored = null;
      }
      // Fallback nativ: copia autoritară din Capacitor Preferences. Rulează
      // doar dacă storage-ul rapid (WebView) nu a livrat nimic — de ex. după
      // un update care a golit localStorage-ul WebView-ului.
      if (!restored && native) {
        try {
          const { recoverNativeSession } = await import("@/lib/session-recovery");
          restored = await withTimeout(recoverNativeSession(), 8_000).catch(() => null);
        } catch {
          restored = null;
        }
      }
      if (cancelled) return;
      window.clearTimeout(loadingGuard);
      setSession((current) => current ?? restored);
      setLoading(false);
      maybeLinkBiz(restored);
    })();

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
