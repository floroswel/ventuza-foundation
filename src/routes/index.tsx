import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ventuza — Dating, elevated." },
      { name: "description", content: "A premium, inclusive dating experience for people who want more than a swipe." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-6 py-10">
      {/* ambient gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />

      <header className="flex items-center justify-between">
        <span className="wordmark text-2xl font-semibold tracking-wide">Ventuza</span>
      </header>

      <section className="relative z-10 my-auto flex flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          Coming soon · invite-grade
        </div>
        <h1 className="wordmark text-6xl font-medium leading-[0.95] sm:text-7xl">Ventuza</h1>
        <p className="mt-6 max-w-md text-balance text-lg leading-relaxed text-muted-foreground">
          Dating, elevated. A quiet, considered place to meet people with depth — for everyone, on every spectrum.
        </p>

        <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
          <Button variant="hero" size="lg" disabled className="opacity-70">
            Sign-up opens soon
          </Button>
        </div>
      </section>

      <footer className="relative z-10 mt-10 flex flex-col items-center gap-3">
        <div className="pride-bar h-0.5 w-16 rounded-full opacity-70" />
        <p className="text-xs text-muted-foreground">For every identity. Every story. Every you.</p>
      </footer>
    </main>
  );
}
