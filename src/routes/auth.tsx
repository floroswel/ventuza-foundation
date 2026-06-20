import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Ventuza" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (isSignup && !accepted) {
      toast.error("Please accept the Terms & Privacy to continue.");
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding` },
        });
        if (error) throw error;
        toast.success("Welcome to Ventuza.");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/profile" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background px-6 py-8">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="my-auto w-full max-w-md self-center">
        <h1 className="wordmark text-4xl font-medium">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-muted-foreground">
          {isSignup ? "Start your Ventuza profile." : "Sign in to continue."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-surface border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-surface border-border" />
            {isSignup && <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>}
          </div>

          {isSignup && (
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
              <span>
                I accept the <a className="text-primary underline-offset-4 hover:underline" href="#">Terms</a> and{" "}
                <a className="text-primary underline-offset-4 hover:underline" href="#">Privacy Policy</a>, and confirm I am 18+.
              </span>
            </label>
          )}

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isSignup ? "Create account" : "Log in"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {isSignup ? "Already a member?" : "New to Ventuza?"}{" "}
          <Link to="/auth" search={{ mode: isSignup ? "login" : "signup" }} className="text-primary hover:underline">
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  );
}
