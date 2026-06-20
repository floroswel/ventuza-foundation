import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, Languages, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMessages, fetchOtherProfile, markRead, sendMessage,
  type MessageRow,
} from "@/lib/chat";
import { generateOpener, translateText } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Chat — Ventuza" }] }),
  component: ThreadPage,
});

function ThreadPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [other, setOther] = useState<{ id: string; name: string | null; photo: string | null; bio?: string | null; interests?: string[] | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [openers, setOpeners] = useState<string[] | null>(null);
  const [wingmanLoading, setWingmanLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const genOpener = useServerFn(generateOpener);
  const tr = useServerFn(translateText);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    async function load() {
      try {
        const { data: conv, error } = await supabase
          .from("conversations")
          .select("user_a, user_b")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!conv) throw new Error("Conversation not found");
        const oid = conv.user_a === user!.id ? conv.user_b : conv.user_a;
        const [msgs, prof, extra] = await Promise.all([
          fetchMessages(id),
          fetchOtherProfile(oid),
          supabase.from("profiles").select("bio, interests").eq("id", oid).maybeSingle(),
        ]);
        if (!alive) return;
        setMessages(msgs);
        setOther({ ...prof, bio: extra.data?.bio ?? null, interests: extra.data?.interests ?? null });
        await markRead(id, user!.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't open chat");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();

    const ch = supabase
      .channel(`thread-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user!.id) void markRead(id, user!.id);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id, user]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      await sendMessage(id, body);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
      setText(body);
    } finally {
      setSending(false);
    }
  }

  async function handleWingman() {
    if (wingmanLoading) return;
    setWingmanLoading(true);
    try {
      const res = await genOpener({
        data: {
          theirName: other?.name ?? undefined,
          theirBio: other?.bio ?? undefined,
          theirInterests: other?.interests ?? [],
          style: "playful",
        },
      });
      setOpeners(res?.openers ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wingman a eșuat");
    } finally {
      setWingmanLoading(false);
    }
  }

  async function handleTranslate(m: MessageRow) {
    if (translations[m.id] || translatingId) return;
    setTranslatingId(m.id);
    try {
      const res = await tr({ data: { text: m.body, targetLang: "ro" } });
      setTranslations((t) => ({ ...t, [m.id]: res.translation }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Traducere eșuată");
    } finally {
      setTranslatingId(null);
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-3 py-3 backdrop-blur">
        <Link to="/messages" className="rounded-full p-2 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="size-9 overflow-hidden rounded-full bg-muted">
          {other?.photo ? (
            <img src={other.photo} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{other?.name ?? "…"}</p>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Say something nice to {other?.name ?? "them"}.
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const mine = m.sender_id === user?.id;
              const translated = translations[m.id];
              return (
                <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md",
                    )}
                  >
                    {m.body}
                  </div>
                  {!mine && (
                    translated ? (
                      <div className="max-w-[78%] rounded-2xl bg-primary/10 px-3 py-2 text-xs text-primary">
                        <span className="mr-1 opacity-70">RO:</span>{translated}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTranslate(m)}
                        disabled={translatingId === m.id}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                      >
                        {translatingId === m.id ? <Loader2 className="size-3 animate-spin" /> : <Languages className="size-3" />}
                        Traduce
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {openers && openers.length > 0 && (
        <div className="border-t border-border/60 bg-surface/60 px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-primary">Wingman AI</p>
            <button onClick={() => setOpeners(null)} className="text-xs text-muted-foreground">×</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {openers.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setText(o); setOpeners(null); }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-left text-sm hover:border-primary"
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 flex items-center gap-2 border-t border-border/60 bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
      >
        <button
          type="button"
          onClick={handleWingman}
          disabled={wingmanLoading}
          aria-label="Wingman AI"
          className="flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary disabled:opacity-50"
        >
          {wingmanLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={4000}
          className="flex-1 rounded-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}
