import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"bug" | "idea" | "general">("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!user) return null;
  // Ascuns pe home (/discover) — accesibil din alte pagini
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/discover"))
    return null;

  async function submit() {
    if (!message.trim() || message.length < 5) {
      toast.error("Scrie un mesaj de minim 5 caractere");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user!.id,
        kind,
        message: message.trim(),
        page: window.location.pathname,
        user_agent: navigator.userAgent.slice(0, 200),
      });
      if (error) throw error;
      toast.success("Mulțumim pentru feedback!");
      setMessage("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Trimite feedback"
          className="fixed bottom-24 right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/10 transition hover:scale-105"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-24 right-3 z-40 w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Feedback</h3>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-2 flex gap-1">
            {(["bug", "idea", "general"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-lg px-2 py-1 text-xs ${kind === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {k === "bug" ? "Bug" : k === "idea" ? "Idee" : "Altul"}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ce vrei să ne spui?"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{message.length}/500</span>
            <button
              onClick={submit}
              disabled={sending}
              className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-3 w-3" /> Trimite
            </button>
          </div>
        </div>
      )}
    </>
  );
}
