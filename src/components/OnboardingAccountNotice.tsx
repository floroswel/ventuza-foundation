/**
 * Banner în onboarding care explică, în limbaj clar, blocajele reale de cont:
 * email neconfirmat sau verificare 18+ eșuată/în așteptare — cu recomandarea
 * exactă pentru pasul următor.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ResendConfirmationButton } from "@/components/ResendConfirmationButton";
import { getMyDiditStatus } from "@/lib/didit.functions";

type Age = "unverified" | "pending" | "verified" | "failed" | "expired" | null;

export function OnboardingAccountNotice() {
  const { user } = useAuth();
  const fetchStatus = useServerFn(getMyDiditStatus);
  const [age, setAge] = useState<Age>(null);

  const emailConfirmed = Boolean(
    (user as { email_confirmed_at?: string | null } | null)?.email_confirmed_at,
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = (await fetchStatus()) as { profile?: { age_status?: string | null } | null };
        if (!cancelled) setAge((res?.profile?.age_status as Age) ?? "unverified");
      } catch {
        /* fără blocaj vizual dacă statusul nu poate fi citit */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchStatus]);

  if (!user) return null;

  const diditProblem = age === "failed" || age === "expired";

  if (emailConfirmed && !diditProblem) return null;

  return (
    <div className="mx-6 mt-4 space-y-3">
      {!emailConfirmed && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium text-amber-100">Emailul nu este confirmat</p>
              <p className="text-xs text-muted-foreground">
                Poți completa profilul, dar contul se activează complet doar după ce deschizi
                linkul din email. Verifică și folderul Spam/Promoții.
              </p>
              <ResendConfirmationButton email={user.email} className="pt-1" variant="outline" />
            </div>
          </div>
        </div>
      )}

      {diditProblem && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium text-destructive">
                {age === "expired" ? "Sesiunea de verificare a expirat" : "Verificarea 18+ a eșuat"}
              </p>
              <p className="text-xs text-muted-foreground">
                Reia verificarea într-un loc bine luminat, fără ochelari de soare sau șapcă, cu
                fața complet în cadru.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link to="/verify">Reia verificarea</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
