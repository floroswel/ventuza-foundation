import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { getMyDiditStatus, syncMyDiditStatus } from "@/lib/didit.functions";

export const Route = createFileRoute("/verify/status")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Status verificare Didit — Suzeta" },
      { name: "description", content: "Urmărește statusul verificării 18+ inițiate prin Didit." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyStatusPage,
});

type AgeStatus = "unverified" | "pending" | "verified" | "failed" | "expired" | null;

type DiditStatus = {
  profile: {
    age_status: string | null;
    age_verified_at: string | null;
    age_provider: string | null;
  } | null;
  lastSession: {
    session_id: string;
    status: string;
    result: string | null;
    estimated_age: number | null;
    session_url: string | null;
    created_at: string;
    resolved_at: string | null;
  } | null;
};

function VerifyStatusPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getMyDiditStatus);
  const syncStatus = useServerFn(syncMyDiditStatus);

  const [status, setStatus] = useState<DiditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth", search: { mode: "login" }, replace: true });
    }
  }, [authLoading, user, navigate]);

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      setRefreshing(true);
      try {
        if (opts?.force) {
          try {
            await syncStatus();
          } catch {
            // ignoră — cădem pe read-ul de mai jos
          }
        }
        const res = (await fetchStatus()) as DiditStatus;
        setStatus(res);
      } catch {
        // silențios — banner-ul de eroare rămâne; retry manual disponibil
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchStatus, syncStatus],
  );

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user?.id, refresh]);

  const ageStatus = (status?.profile?.age_status as AgeStatus) ?? "unverified";
  const isPending = ageStatus === "pending" || ageStatus === "unverified";
  const isVerified = ageStatus === "verified";
  const isFailed = ageStatus === "failed" || ageStatus === "expired";

  // Polling agresiv la început, apoi mai rar; se oprește când iese din pending.
  useEffect(() => {
    if (!user || !isPending) return;
    const tick = () => void refresh({ force: true });
    const elapsed = Date.now() - startedAt.current;
    const interval = elapsed < 60_000 ? 3000 : elapsed < 300_000 ? 8000 : 20_000;
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [isPending, user?.id, refresh, status?.profile?.age_status]);

  if (authLoading || loading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5">
        <Loader2 className="size-7 animate-spin text-primary" />
      </main>
    );
  }
  if (!user) return null;

  const lastSession = status?.lastSession;

  const statusAnnouncement = isVerified
    ? "Verificare reușită. Contul tău este activat pentru acces 18 plus."
    : isFailed
      ? ageStatus === "expired"
        ? "Verificare eșuată: sesiunea Didit a expirat."
        : "Verificare eșuată: Didit nu a putut confirma vârsta."
      : "În așteptare. Didit procesează selfie-ul tău.";

  return (
    <main className="min-h-dvh bg-background pb-10 text-foreground">
      <div className="mx-auto max-w-md px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <Link
          to="/verify"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          aria-label="Înapoi la pagina de verificare"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Înapoi la verificare
        </Link>

        <header className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> Status Didit
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Verificare vârstă
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Urmărim în timp real răspunsul de la Didit. Poți lăsa pagina deschisă.
          </p>
        </header>

        {/* Anunț pentru cititoare de ecran: se actualizează la fiecare schimbare de stare */}
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {statusAnnouncement}
        </p>

        <div
          role="region"
          aria-label="Status verificare Didit"
          aria-busy={isPending}
        >
          {isVerified && (
            <section className="mt-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
              <div
                className="mx-auto grid size-16 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/15"
                aria-hidden="true"
              >
                <BadgeCheck className="size-8 text-emerald-300" />
              </div>
              <p className="mt-4 text-lg font-semibold text-emerald-100">
                Verificare reușită
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Contul tău este activat 18+. Poți folosi toate funcțiile.
              </p>
              {status?.profile?.age_verified_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Confirmat:{" "}
                  <time dateTime={status.profile.age_verified_at}>
                    {new Date(status.profile.age_verified_at).toLocaleString("ro-RO")}
                  </time>
                </p>
              )}
              <Button asChild className="mt-6 w-full">
                <Link to="/discover">Continuă spre Discover</Link>
              </Button>
            </section>
          )}

          {isPending && (
            <section
              className="mt-8 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center"
              aria-labelledby="verify-pending-title"
            >
              <div
                className="mx-auto grid size-16 place-items-center rounded-full border border-amber-400/40 bg-amber-500/15"
                aria-hidden="true"
              >
                <Loader2 className="size-8 animate-spin text-amber-300" />
              </div>
              <p id="verify-pending-title" className="mt-4 text-lg font-semibold text-amber-100">
                În așteptare
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Didit procesează selfie-ul tău. De obicei durează sub 60 de secunde.
                Actualizăm automat statusul.
              </p>

              {/* Bară de progres indeterminată, anunțată corect ca "în progres" */}
              <div
                role="progressbar"
                aria-label="Verificare în curs la Didit"
                aria-valuetext="Se procesează"
                className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-amber-500/20"
              >
                <div className="h-full w-1/3 animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-amber-400/80" />
              </div>

              {lastSession?.session_url && (
                <a
                  href={lastSession.session_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  aria-label="Deschide fluxul Didit într-o filă nouă"
                >
                  Deschide fluxul Didit din nou{" "}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => void refresh({ force: true })}
                disabled={refreshing}
                aria-label={
                  refreshing
                    ? "Se reîmprospătează statusul"
                    : "Reîmprospătează statusul verificării"
                }
              >
                {refreshing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                {refreshing ? "Se reîmprospătează…" : "Reîmprospătează"}
              </Button>
            </section>
          )}

          {isFailed && (
            <section
              className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center"
              aria-labelledby="verify-failed-title"
            >
              <div
                className="mx-auto grid size-16 place-items-center rounded-full border border-destructive/40 bg-destructive/15"
                aria-hidden="true"
              >
                <XCircle className="size-8 text-destructive" />
              </div>
              <p id="verify-failed-title" className="mt-4 text-lg font-semibold text-destructive">
                Verificare eșuată
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {ageStatus === "expired"
                  ? "Sesiunea Didit a expirat înainte de finalizare."
                  : "Didit nu a putut confirma vârsta. Verifică lumina și încadrarea feței, apoi reia."}
              </p>
              {lastSession?.estimated_age != null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Vârstă estimată: ~{lastSession.estimated_age} ani
                </p>
              )}
              <Button asChild className="mt-6 w-full">
                <Link to="/verify">Reia verificarea</Link>
              </Button>
            </section>
          )}
        </div>


        {lastSession && (
          <section className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Detalii sesiune</p>
            <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              <dt>Sesiune</dt>
              <dd className="truncate font-mono">{lastSession.session_id}</dd>
              <dt>Status</dt>
              <dd>{lastSession.status}</dd>
              {lastSession.result && (
                <>
                  <dt>Rezultat</dt>
                  <dd>{lastSession.result}</dd>
                </>
              )}
              <dt>Începută</dt>
              <dd>{new Date(lastSession.created_at).toLocaleString("ro-RO")}</dd>
              {lastSession.resolved_at && (
                <>
                  <dt>Finalizată</dt>
                  <dd>{new Date(lastSession.resolved_at).toLocaleString("ro-RO")}</dd>
                </>
              )}
            </dl>
          </section>
        )}
      </div>
    </main>
  );
}
