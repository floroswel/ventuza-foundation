import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Coming soon — Ventuza" }] }),
  component: AuthDisabled,
});

function AuthDisabled() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 py-10 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />
      <div className="relative z-10 max-w-sm">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          Temporarily closed
        </div>
        <h1 className="wordmark text-4xl font-medium">Sign-in is paused</h1>
        <p className="mt-4 text-muted-foreground">
          We're polishing the experience. Authentication will be back online soon.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-8">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
