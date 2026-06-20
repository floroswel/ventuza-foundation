import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/discover", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Ventuza — Dating, elevated." },
      { name: "description", content: "A premium, inclusive dating experience for people who want more than a swipe." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) navigate({ to: "/discover", replace: true });
  }, [loading, navigate]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 py-10 text-center">
      {/* ambient gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />

      <section className="relative z-10 flex flex-col items-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          Opening preview
        </div>
        <h1 className="wordmark text-6xl font-medium leading-[0.95] sm:text-7xl">Ventuza</h1>
        <p className="mt-6 max-w-md text-balance text-lg leading-relaxed text-muted-foreground">Loading the people grid…</p>
      </section>

      <footer className="absolute bottom-10 z-10 flex flex-col items-center gap-3">
        <div className="pride-bar h-0.5 w-16 rounded-full opacity-70" />
        <p className="text-xs text-muted-foreground">For every identity. Every story. Every you.</p>
      </footer>
    </main>
  );
}
