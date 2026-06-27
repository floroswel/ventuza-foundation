import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/auth/check-email")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Confirmă emailul — Ventuza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckEmailPage,
});

function CheckEmailPage() {
  const { email } = Route.useSearch();
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email) {
      toast.error("Lipsește adresa de email — întoarce-te la pasul de înregistrare.");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/n` },
      });
      if (error) throw error;
      toast.success("Trimis. Verifică inbox + spam.");
      setCooldown(60);
    } catch (e: any) {
      toast.error(e.message ?? "Nu am putut retrimite emailul.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center space-y-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Verifică-ți emailul</h1>
        <p className="text-sm text-muted-foreground">
          Ți-am trimis un link de confirmare{" "}
          {email ? (
            <>
              la <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : (
            "."
          )}{" "}
          Deschide-l pentru a-ți activa contul.
        </p>
        <p className="text-xs text-muted-foreground">
          Nu vezi emailul? Verifică folderul Spam / Promoții.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={resend} disabled={resending || cooldown > 0 || !email}>
            {resending && <Loader2 className="size-4 animate-spin mr-2" />}
            {cooldown > 0 ? `Retrimite în ${cooldown}s` : "Retrimite emailul"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth" search={{ mode: "login" }}>Înapoi la autentificare</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
