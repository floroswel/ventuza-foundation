import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle, Check, CheckCheck, ChevronLeft, Clock, CornerUpLeft, Languages,
  Loader2, MoreVertical, Send, Smile, Sparkles, Trash2, X as XIcon,
} from "lucide-react";
import { ReportBlockDialog } from "@/components/ReportBlockDialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  MESSAGES_PAGE, fetchMessages, fetchOtherProfile, markRead, sendMessage, unsendMessage,
  type MessageRow,
} from "@/lib/chat";
import { generateOpener, translateText } from "@/lib/ai.functions";
import { REACTION_EMOJIS, toggleMessageReaction, type ReactionEmoji } from "@/lib/social";
import { ChatComposerExtras } from "@/components/ChatComposerExtras";
import { ChatMediaBubble } from "@/components/ChatMediaBubble";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Chat — Ventuza" }] }),
  component: ThreadPage,
});

type UiMessage = MessageRow & { _status?: "pending" | "failed" };

function ThreadPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [other, setOther] = useState<{ id: string; name: string | null; photo: string | null; bio?: string | null; interests?: string[] | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [openers, setOpeners] = useState<string[] | null>(null);
  const [wingmanLoading, setWingmanLoading] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [connected, setConnected] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const genOpener = useServerFn(generateOpener);
  const tr = useServerFn(translateText);

  async function handleReact(msgId: string, emoji: ReactionEmoji) {
    setReactionPickerFor(null);
    try {
      const next = await toggleMessageReaction(msgId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: next } : m)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  // Initial load + realtime channel
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
        setHasMore(msgs.length >= MESSAGES_PAGE);
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
      .channel(`thread-${id}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user!.id) {
            setOtherTyping(false);
            void markRead(id, user!.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const p = payload.payload as { userId: string };
        if (p.userId !== user!.id) {
          setOtherTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    channelRef.current = ch;

    return () => {
      alive = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [id, user]);

  // Auto scroll to bottom on new messages (only when near bottom)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function loadMore() {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const el = scrollerRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const oldest = messages[0];
      const older = await fetchMessages(id, { before: oldest.created_at });
      if (older.length === 0) setHasMore(false);
      else {
        setMessages((prev) => [...older, ...prev]);
        if (older.length < MESSAGES_PAGE) setHasMore(false);
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevHeight;
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollTop < 60 && hasMore && !loadingMore) void loadMore();
  }

  function sendTypingPing() {
    if (!channelRef.current || !user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    void channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: user.id } });
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    const tempId = `tmp-${crypto.randomUUID()}`;
    const replyId = replyTo?.id ?? null;
    const optimistic: UiMessage = {
      id: tempId,
      conversation_id: id,
      sender_id: user.id,
      body,
      read_at: null,
      created_at: new Date().toISOString(),
      reply_to_id: replyId,
      _status: "pending",
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setReplyTo(null);
    try {
      const real = await sendMessage(id, body, replyId);
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== tempId && m.id !== real.id);
        return [...without, real];
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: "failed" } : m)));
    }
  }

  async function handleUnsend(m: MessageRow) {
    if (!confirm("Șterge mesajul pentru toți? Doar în primele 5 minute.")) return;
    try {
      await unsendMessage(m.id);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), body: "", media_url: null, media_type: "text" } : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't unsend");
    }
  }

  async function retryFailed(m: UiMessage) {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, _status: "pending" } : x)));
    try {
      const real = await sendMessage(id, m.body);
      setMessages((prev) => {
        const without = prev.filter((x) => x.id !== m.id && x.id !== real.id);
        return [...without, real];
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, _status: "failed" } : x)));
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
          <p className="truncate text-[10px] text-muted-foreground">
            {otherTyping ? <span className="text-primary">typing…</span> : connected ? "online" : "reconnecting…"}
          </p>
        </div>
        {other?.id && (
          <ReportBlockDialog
            targetUserId={other.id}
            targetName={other.name ?? undefined}
            onBlocked={() => navigate({ to: "/messages" })}
            trigger={
              <button className="rounded-full p-2 text-muted-foreground hover:text-foreground" aria-label="Opțiuni">
                <MoreVertical className="size-5" />
              </button>
            }
          />
        )}
      </header>

      <div ref={scrollerRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Say something nice to {other?.name ?? "them"}.
          </p>
        ) : (
          <>
            {loadingMore && (
              <div className="flex justify-center py-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            <ul className="space-y-2">
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                const translated = translations[m.id];
                const replied = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                const canUnsend = mine && !m.deleted_at && Date.now() - new Date(m.created_at).getTime() < 5 * 60_000;
                const isDeleted = !!m.deleted_at;
                return (
                  <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                    <div className={cn("group relative flex w-full items-end gap-1", mine ? "justify-end" : "justify-start")}>
                      {!mine && !isDeleted && (
                        <div className="order-2 mb-1 hidden gap-1 group-hover:flex">
                          <button type="button" onClick={() => setReplyTo(m)} aria-label="Reply" className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                            <CornerUpLeft className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)} aria-label="React" className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                            <Smile className="size-3.5" />
                          </button>
                        </div>
                      )}
                      <div
                        className={cn(
                          "order-1 max-w-[82%]",
                          m._status === "pending" && "opacity-70",
                          m._status === "failed" && "rounded-2xl ring-1 ring-destructive/60",
                        )}
                      >
                        {replied && !isDeleted && (
                          <div className={cn(
                            "mb-1 rounded-xl border-l-2 px-2 py-1 text-[11px]",
                            mine ? "border-primary-foreground/40 bg-primary/20 text-primary-foreground/80" : "border-primary/40 bg-muted text-muted-foreground",
                          )}>
                            <p className="truncate font-medium opacity-80">↩ {replied.sender_id === user?.id ? "Tu" : (other?.name ?? "…")}</p>
                            <p className="line-clamp-2 opacity-90">{replied.deleted_at ? "Mesaj șters" : replied.body || (replied.media_type === "image" ? "📷 Photo" : replied.media_type === "audio" ? "🎤 Voice" : replied.media_type === "location" ? "📍 Location" : "")}</p>
                          </div>
                        )}
                        {isDeleted ? (
                          <div className={cn(
                            "inline-flex items-center gap-1.5 rounded-2xl border border-dashed px-3 py-2 text-xs italic",
                            mine ? "border-primary-foreground/30 bg-primary/30 text-primary-foreground/80" : "border-border bg-muted text-muted-foreground",
                          )}>
                            <Trash2 className="size-3" /> Mesaj șters
                          </div>
                        ) : (
                          <ChatMediaBubble m={m} mine={mine} />
                        )}
                      </div>
                      {mine && !isDeleted && (
                        <div className="order-0 mb-1 hidden gap-1 group-hover:flex">
                          {canUnsend && (
                            <button type="button" onClick={() => handleUnsend(m)} aria-label="Unsend" className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => setReplyTo(m)} aria-label="Reply" className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                            <CornerUpLeft className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)} aria-label="React" className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                            <Smile className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {reactionPickerFor === m.id && (
                      <div className={cn("flex gap-1 rounded-full border border-border bg-background px-2 py-1.5 shadow-lg", mine ? "self-end" : "self-start")}>
                        {REACTION_EMOJIS.map((e) => {
                          const active = user && (m.reactions?.[e] ?? []).includes(user.id);
                          return (
                            <button
                              key={e}
                              onClick={() => handleReact(m.id, e)}
                              className={cn("text-base transition-transform hover:scale-125", active && "scale-110")}
                            >
                              {e}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {m.reactions && Object.keys(m.reactions).length > 0 && (
                      <div className={cn("-mt-1 flex flex-wrap gap-1", mine ? "self-end" : "self-start")}>
                        {Object.entries(m.reactions).map(([emoji, users]) => {
                          if (!users || users.length === 0) return null;
                          const mineReact = user ? users.includes(user.id) : false;
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReact(m.id, emoji as ReactionEmoji)}
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                                mineReact
                                  ? "border-primary bg-primary/15 text-primary"
                                  : "border-border bg-background/60 text-muted-foreground hover:border-primary/40",
                              )}
                            >
                              {emoji} {users.length}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {mine && (
                      <div className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                        {m._status === "pending" ? (
                          <><Clock className="size-3" /> sending</>
                        ) : m._status === "failed" ? (
                          <button onClick={() => retryFailed(m)} className="inline-flex items-center gap-1 text-destructive">
                            <AlertCircle className="size-3" /> failed · tap to retry
                          </button>
                        ) : m.read_at ? (
                          <><CheckCheck className="size-3 text-primary" /> read</>
                        ) : (
                          <><Check className="size-3" /> sent</>
                        )}
                      </div>
                    )}
                    {!mine && m.media_type !== "audio" && m.media_type !== "image" && m.media_type !== "location" && (
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
              {otherTyping && (
                <li className="flex items-start">
                  <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2">
                    <span className="inline-flex gap-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-foreground/60" />
                    </span>
                  </div>
                </li>
              )}
            </ul>
          </>
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

      {replyTo && (
        <div className="flex items-start gap-2 border-t border-border/60 bg-surface/70 px-3 py-2">
          <CornerUpLeft className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 border-l-2 border-primary/60 pl-2">
            <p className="text-[11px] font-medium text-primary">Răspunde la {replyTo.sender_id === user?.id ? "tine" : (other?.name ?? "…")}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{replyTo.deleted_at ? "Mesaj șters" : replyTo.body || "📎 media"}</p>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground">
            <XIcon className="size-4" />
          </button>
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
        <ChatComposerExtras
          conversationId={id}
          onSent={(m) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))}
        />
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); sendTypingPing(); }}
          placeholder="Type a message…"
          maxLength={4000}
          className="flex-1 rounded-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
