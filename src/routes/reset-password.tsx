import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Ventuza" }] }),
  component: ResetPasswordPage,
});

const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase puts recovery tokens in the URL hash and the client picks them up automatically.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return toast.error(parsed.error.issues[0]!.message);
    if (password !== confirm) return toast.error("Passwords don't match");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    navigate({ to: "/discover", replace: true });
  }

  return (
    <main className="relative min-h-dvh bg-background px-6 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="wordmark text-4xl font-medium">Ventuza</h1>
        <h2 className="mt-6 text-xl font-medium">Choose a new password</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {ready ? "Enter a new password for your account." : "Validating your reset link…"}
        </p>

        {ready && (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Confirm password</Label>
              <Input id="pw2" type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={submitting} className="h-12 w-full rounded-full text-sm uppercase tracking-[0.18em]">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
