import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Ventuza" }] }),
  component: AuthPage,
});

function AuthPage() {
  Route.useSearch();
  const navigate = useNavigate();
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) navigate({ to: "/discover", replace: true });
  }, [loading, navigate]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <Loader2 className="size-6 animate-spin text-primary" />
      <h1 className="wordmark mt-5 text-4xl font-medium">Ventuza</h1>
      <p className="mt-2 text-sm text-muted-foreground">Opening the people grid…</p>
    </main>
  );
}
