import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ventuza — Dating, elevated." },
      { name: "description", content: "A premium, inclusive dating experience for people who want more than a swipe." },
      { property: "og:title", content: "Ventuza — Dating, elevated." },
      { property: "og:description", content: "Meet people who match your depth — not just your swipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ventuza — Dating, elevated." },
      { name: "twitter:description", content: "Meet people who match your depth — not just your swipe." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      navigate({
        to: data?.onboarding_completed ? "/discover" : "/onboarding",
        replace: true,
      });
    })();
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 py-10 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />

      <section className="relative z-10 flex flex-col items-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          18+ · Premium dating
        </div>
        <h1 className="wordmark text-6xl font-medium leading-[0.95] sm:text-7xl">Ventuza</h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
          Dating, elevated. Meet people who match your depth — not just your swipe.
        </p>

        <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary text-sm uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create account
          </Link>
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="inline-flex h-12 items-center justify-center rounded-full border border-primary/30 bg-surface text-sm uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/10"
          >
            Log in
          </Link>
        </div>

        <p className="mt-8 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/legal/terms" className="text-primary hover:underline">Terms</Link> and{" "}
          <Link to="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>

        <div className="mt-10 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Link to="/business" className="hover:text-primary">Pentru parteneri →</Link>
          <span className="opacity-30">·</span>
          <Link to="/safety" className="hover:text-primary">Siguranță</Link>
        </div>
      </section>
    </main>
  );
}
