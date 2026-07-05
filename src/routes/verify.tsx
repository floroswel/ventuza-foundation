import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { getMyDiditStatus, startDiditVerification, syncMyDiditStatus } from "@/lib/didit.functions";

export const Route = createFileRoute("/verify")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Verificare 18+ — Ventuza" },
      {
        name: "description",
        content: "Verificarea vârstei se face prin Didit (procesator UE, imagine tranzitorie).",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

type AgeStatus = "unverified" | "pending" | "verified" | "failed" | "expired" | null;

type DiditStatus = {
  profile: { age_status: string | null; age_verified_at: string | null; age_provider: string | null } | null;
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

function VerifyPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getMyDiditStatus);
  const startSession = useServerFn(startDiditVerification);
  const syncStatus = useServerFn(syncMyDiditStatus);

  const [status, setStatus] = useState<DiditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth", search: { mode: "login" }, replace: true });
    }
  }, [authLoading, user, navigate]);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    try {
      if (opts?.force) {
        try {
          await syncStatus();
        } catch {
          // ignoră — statusul local rămâne disponibil și următorul poll mai încearcă
        }
      }
      const res = (await fetchStatus()) as DiditStatus;
      setStatus(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nu am putut citi statusul.");
    } finally {
      setLoading(false);
    }
  }, [fetchStatus, syncStatus]);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user?.id, refresh]);

  // Când userul se întoarce din Didit (`?didit=return`), forțează refresh
  // și apoi mai periodic până statusul iese din pending.
  useEffect(() => {
    if (!user) return;
    const pending = status?.profile?.age_status === "pending";
    if (!pending) return;
    const id = setInterval(() => void refresh({ force: true }), 5000);
    return () => clearInterval(id);
  }, [status?.profile?.age_status, user?.id, refresh]);

  const ageStatus = (status?.profile?.age_status as AgeStatus) ?? "unverified";
  const lastSession = status?.lastSession ?? null;
  const isPending = ageStatus === "pending";
  const isFailed = ageStatus === "failed" || ageStatus === "expired";

  async function beginVerification() {
    if (!user || starting) return;
    setStarting(true);
    try {
      const returnUrl = `${window.location.origin}/verify/status`;
      const res = (await startSession({ data: { returnUrl } })) as {
        sessionId: string;
        url: string;
      };
      if (!res?.url) throw new Error("Didit nu a returnat un URL de verificare.");
      window.location.assign(res.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nu am putut porni verificarea.");
      setStarting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <Loader2 className="size-7 animate-spin text-primary" />
      </main>
    );
  }
  if (!user) return null;

  if (ageStatus === "verified") {
    return (
      <main className="min-h-screen bg-background px-5 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)] text-foreground">
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
          <div className="grid size-20 place-items-center rounded-full border border-primary/30 bg-primary/10">
            <BadgeCheck className="size-10 text-primary" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Cont verificat</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Ai deja verificarea 18+ activă și poți folosi toate funcțiile sociale.
          </p>
          <Button asChild className="mt-8 w-full">
            <Link to="/discover">Continuă</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-10 text-foreground">
      <div className="mx-auto max-w-md px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <BackLink />

        <header className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> Verificare 18+ prin Didit
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Verificare</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Folosim <strong>Didit</strong> (procesator UE) pentru estimarea automată a vârstei
            dintr-un selfie live. Imaginea este ștearsă imediat la Didit; noi primim doar
            rezultatul (pass/fail) și o vârstă estimată.
          </p>
        </header>

        {isPending && (
          <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 size-5 animate-spin text-amber-400" />
              <div>
                <p className="font-semibold text-amber-200">Verificare în curs</p>
                <p className="mt-1 text-muted-foreground">
                  Am înregistrat sesiunea ta Didit. Aștept rezultatul — pagina se actualizează
                  automat.
                </p>
                {lastSession?.session_url && (
                  <a
                    href={lastSession.session_url}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Deschide din nou fluxul Didit <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 w-full"
                onClick={() => void refresh({ force: true })}
            >
              <RefreshCw className="size-4" /> Reîmprospătează statusul
            </Button>
          </section>
        )}

        {isFailed && (
          <section className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 size-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">
                  Verificarea anterioară nu a fost aprobată.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Poți relua verificarea. Asigură-te că ai lumină bună și fața clar vizibilă.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-5 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Cum funcționează</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Apeși butonul de mai jos și te redirecționăm la Didit.</li>
            <li>Faci un selfie live cu un scurt challenge (~30 secunde).</li>
            <li>Didit ne trimite rezultatul (pass/fail) și te aducem înapoi.</li>
          </ol>
          <p className="mt-3">
            Nu trimitem nume, email sau alte date de profil. Vezi{" "}
            <Link to="/legal/subprocessors" className="text-primary hover:underline">
              lista procesatorilor
            </Link>{" "}
            pentru detalii.
          </p>
        </section>

        <Button
          type="button"
          size="lg"
          onClick={beginVerification}
          disabled={starting}
          className="mt-6 w-full"
        >
          {starting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {isPending ? "Reia verificarea Didit" : "Începe verificarea Didit"}
        </Button>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Didit rulează în UE. Imaginea nu este stocată de Ventuza.
        </div>
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link to="/account" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <ArrowLeft className="size-4" /> Cont
    </Link>
  );
}
