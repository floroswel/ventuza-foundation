import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  enqueueMessage,
  flushOutbox,
  removeFromOutbox,
  retryFailedOutbox,
  subscribeOutbox,
  type OutboxItem,
} from "@/lib/message-outbox";

import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock,
  CornerUpLeft,
  Languages,
  Loader2,
  MoreVertical,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  X as XIcon,
} from "lucide-react";
import { ReportBlockDialog } from "@/components/ReportBlockDialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  MESSAGES_PAGE,
  fetchMessages,
  fetchOtherProfile,
  markDelivered,
  markRead,
  sendMessage,
  unsendMessage,
  type MessageRow,
} from "@/lib/chat";
import { generateOpener, translateText } from "@/lib/ai.functions";
import {
  CHAT_TARGET_LANGS,
  langLabel,
  loadPreferredTargetLang,
  savePreferredTargetLang,
} from "@/lib/languages";
import { verifySelfie } from "@/lib/verification.functions";
import { REACTION_EMOJIS, toggleMessageReaction, type ReactionEmoji } from "@/lib/social";
import { ChatComposerExtras } from "@/components/ChatComposerExtras";
import { ChatMediaBubble } from "@/components/ChatMediaBubble";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SwipeToReply } from "@/components/SwipeToReply";
import {
  VirtualizedMessages,
  type VirtualizedMessagesHandle,
} from "@/components/VirtualizedMessages";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Chat — Ventuza" }] }),
  component: ThreadPage,
});

type UiMessage = MessageRow & { _status?: "pending" | "failed" };

function ThreadPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Cache key ["conversation-messages", id] este în allowlist-ul persister-ului
  // → apare offline la re-open. UI-ul folosește `messages` ca sursă de adevăr
  // (pentru optimistic + realtime), iar la schimbări sincronizează în cache.
  const cachedInitial = queryClient.getQueryData<MessageRow[]>(["conversation-messages", id]);
  const [messages, setMessages] = useState<UiMessage[]>(() => cachedInitial ?? []);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);

  const [other, setOther] = useState<{
    id: string;
    name: string | null;
    photo: string | null;
    verified: boolean;
    profile_slug: string | null;
    bio?: string | null;
    interests?: string[] | null;
  } | null>(null);
  const [loading, setLoading] = useState(!cachedInitial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState("");
  const [translations, setTranslations] = useState<
    Record<string, { translation: string; detected: string; target: string }>
  >({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translateOpenFor, setTranslateOpenFor] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string>(() => loadPreferredTargetLang());
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const [openers, setOpeners] = useState<string[] | null>(null);
  const [wingmanLoading, setWingmanLoading] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [connected, setConnected] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [heartPulseFor, setHeartPulseFor] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; ts: number } | null>(null);
  const [unsendTarget, setUnsendTarget] = useState<MessageRow | null>(null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [meVerified, setMeVerified] = useState<boolean | null>(null);
  const [myMainPhoto, setMyMainPhoto] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const genOpener = useServerFn(generateOpener);
  const tr = useServerFn(translateText);
  const verifyFn = useServerFn(verifySelfie);

  // Load my verification status + main photo path once
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("verified, photos")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMeVerified(!!data?.verified);
        const photos = (data?.photos ?? []) as string[];
        setMyMainPhoto(photos[0] ?? null);
      });
  }, [user]);

  const [isBlocked, setIsBlocked] = useState(false);
  const hasInbound = messages.some((m) => m.sender_id && m.sender_id !== user?.id);
  void meVerified;
  void hasInbound;
  const blockedFirstMessage = isBlocked;

  async function handleVerifyFile(file: File) {
    if (!user) return;
    if (!myMainPhoto) {
      toast.error("Adaugă întâi o poză principală în profil.");
      return;
    }
    setVerifying(true);
    try {
      const path = `${user.id}/selfie-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const [{ data: sa }, { data: sb }] = await Promise.all([
        supabase.storage.from("profile-photos").createSignedUrl(path, 600),
        supabase.storage.from("profile-photos").createSignedUrl(myMainPhoto, 600),
      ]);
      if (!sa?.signedUrl || !sb?.signedUrl) throw new Error("Nu am putut accesa pozele.");
      await supabase
        .from("profiles")
        .update({ verification_status: "pending" })
        .eq("id", user.id);
      const res = await verifyFn({ data: { selfieUrl: sa.signedUrl, mainPhotoUrl: sb.signedUrl } });
      if (res.verified) {
        setMeVerified(true);
        toast.success("Verificat ✓ — ai badge-ul oficial.");
      } else {
        toast.error(`Verificare eșuată: ${res.reason ?? "încearcă din nou"}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verificare eșuată");
    } finally {
      setVerifying(false);
    }
  }

  async function handleReact(msgId: string, emoji: ReactionEmoji) {
    setReactionPickerFor(null);
    try {
      const next = await toggleMessageReaction(msgId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: next } : m)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function quickLike(m: MessageRow) {
    if (m.deleted_at) return;
    setHeartPulseFor(m.id);
    window.setTimeout(() => {
      setHeartPulseFor((cur) => (cur === m.id ? null : cur));
    }, 700);
    void handleReact(m.id, "❤️");
  }

  function handleBubbleTap(m: MessageRow) {
    // Double-tap detection pentru mobile (onDoubleClick nu se declanșează pe touch).
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === m.id && now - last.ts < 300) {
      lastTapRef.current = null;
      quickLike(m);
    } else {
      lastTapRef.current = { id: m.id, ts: now };
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
        const [msgs, prof, extraRes] = await Promise.all([
          fetchMessages(id),
          fetchOtherProfile(oid),
          supabase.rpc("get_public_profiles", { _ids: [oid] }),
        ]);
        if (!alive) return;
        setMessages(msgs);
        setHasMore(msgs.length >= MESSAGES_PAGE);
        const extra =
          ((extraRes.data ?? []) as Array<{ bio: string | null; interests: string[] | null }>)[0] ??
          null;
        setOther({ ...prof, bio: extra?.bio ?? null, interests: extra?.interests ?? null });
        // Bilateral block check (either direction) — server-side via SECURITY DEFINER RPC.
        // Default to NOT blocked on any error, so a transient RPC failure never disables the composer.
        const { data: blockedRes, error: blockErr } = await supabase.rpc(
          "is_blocked_between" as never,
          { a: user!.id, b: oid } as never,
        );
        if (blockErr) {
          console.warn("[messages] is_blocked_between failed, defaulting to not blocked:", blockErr);
        }
        if (alive) setIsBlocked(!blockErr && Boolean(blockedRes));
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
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
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
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
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

  // Mirror mesajele reale (persistate în DB, nu optimiste/pending) în cache-ul
  // TanStack Query, sub cheia din allowlist-ul persister-ului. Astfel la
  // re-open offline, `cachedInitial` mai sus reface instant conversația.
  useEffect(() => {
    const clean = messages.filter((m) => !m._status && !m.id.startsWith("tmp-"));
    if (clean.length > 0) {
      queryClient.setQueryData(["conversation-messages", id], clean.slice(-50));
    }
  }, [messages, id, queryClient]);

  // Outbox — mesaje scrise offline. Se afișează ca "pending" în UI și se trimit
  // automat la reconectare prin wireOutboxAutoFlush() din __root.
  useEffect(() => {
    const unsub = subscribeOutbox((all) => {
      setOutbox(all.filter((x) => x.conversation_id === id && x.status !== "sent"));
    });
    return unsub;
  }, [id]);



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
    void channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id },
    });
  }

  async function reportSendError(e: unknown) {
    const err = e as (Error & { code?: string }) | undefined;
    const code = err?.code;
    if (code === "age_verification_required") {
      let status: string | null = null;
      try {
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("age_status")
            .eq("id", user.id)
            .maybeSingle();
          status = (data?.age_status as string | null) ?? null;
        }
      } catch {
        /* ignore */
      }
      const statusLabel: Record<string, string> = {
        verified: "verified",
        pending: "pending (verificarea încă se procesează)",
        unverified: "unverified (nu ai început verificarea)",
        failed: "failed (verificarea a eșuat)",
        expired: "expired (sesiunea a expirat)",
      };
      const shown = status ? (statusLabel[status] ?? status) : "necunoscut";
      toast.error("Mesajul nu a fost trimis — verificare 18+ obligatorie", {
        description: `Statusul tău actual: ${shown}. Termină verificarea pentru a trimite mesaje.`,
        duration: 8000,
        action: {
          label: "Verifică acum",
          onClick: () => navigate({ to: "/verify" as never }),
        },
      });
      return;
    }
    if (code === "email_not_confirmed") {
      toast.error("Confirmă emailul", {
        description: "Trebuie să îți confirmi emailul înainte de a trimite mesaje.",
        duration: 6000,
      });
      return;
    }
    toast.error(err?.message ?? "Nu am putut trimite mesajul");
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    const replyId = replyTo?.id ?? null;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    // Offline: mesajul intră în outbox persistent (Preferences pe nativ /
    // localStorage pe web). Se afișează instant ca "În așteptare" via
    // subscribeOutbox și se trimite automat la reconectare.
    if (offline) {
      try {
        await enqueueMessage({ conversation_id: id, body, reply_to_id: replyId });
        setText("");
        setReplyTo(null);
        toast.message("Ești offline — mesajul va pleca la reconectare.");
      } catch {
        toast.error("Nu am putut salva mesajul în coada offline.");
      }
      return;
    }
    const tempId = `tmp-${crypto.randomUUID()}`;
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
      await reportSendError(e);
      // Fallback: pune în outbox ca să retry la reconectare (dedup prin client_id).
      try {
        await enqueueMessage({ conversation_id: id, body, reply_to_id: replyId });
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: "failed" } : m)));
      }
    }
  }




  async function confirmUnsend() {
    const m = unsendTarget;
    if (!m) return;
    setUnsendTarget(null);
    try {
      await unsendMessage(m.id);
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id
            ? {
                ...x,
                deleted_at: new Date().toISOString(),
                body: "",
                media_url: null,
                media_type: "text",
              }
            : x,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't unsend");
    }
  }

  async function retryFailed(m: UiMessage) {
    // Item din outbox (persistat) — retry prin coadă (dedup prin client_id).
    if (m.id.startsWith("outbox-")) {
      const clientId = m.id.slice("outbox-".length);
      await retryFailedOutbox(clientId);
      return;
    }
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, _status: "pending" } : x)));
    try {
      // Păstrează reply_to_id la retry — altfel răspunsul își pierde legătura silențios.
      const real = await sendMessage(id, m.body, m.reply_to_id ?? null);
      setMessages((prev) => {
        const without = prev.filter((x) => x.id !== m.id && x.id !== real.id);
        return [...without, real];
      });
    } catch (e) {
      await reportSendError(e);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, _status: "failed" } : x)));
    }
  }

  // Curățare outbox item pending când mesajul real apare din realtime (dedup
  // pe body + sender + timestamp apropiat, best-effort).
  useEffect(() => {
    if (outbox.length === 0 || !user) return;
    const recent = messages.filter(
      (m) => !m._status && m.sender_id === user.id && Date.now() - new Date(m.created_at).getTime() < 5 * 60_000,
    );
    for (const o of outbox) {
      const match = recent.find((r) => r.body === o.body);
      if (match) void removeFromOutbox(o.client_id);
    }
  }, [messages, outbox, user]);

  // Trigger flush când user-ul deschide conversația online (îl scoate din
  // starea "pending" salvată de o sesiune anterioară).
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine !== false) {
      void flushOutbox({ convId: id });
    }
  }, [id]);


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

  async function runTranslate(m: MessageRow, lang: string, force = false) {
    if (!m.body) return;
    if (!force && translations[m.id]?.target === lang) return;
    if (translatingId) return;
    setTranslatingId(m.id);
    try {
      const res = await tr({ data: { text: m.body, targetLang: lang } });
      setTranslations((t) => ({
        ...t,
        [m.id]: {
          translation: res.translation,
          detected: res.detected ?? "auto",
          target: res.target ?? lang,
        },
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Traducere eșuată");
    } finally {
      setTranslatingId(null);
    }
  }

  function openTranslationFor(m: MessageRow) {
    if (!m.body || m.deleted_at) return;
    setTranslateOpenFor(m.id);
    if (!translations[m.id]) void runTranslate(m, targetLang);
  }

  function handleBubblePressStart(m: MessageRow) {
    if (!m.body || m.deleted_at || m.sender_id === user?.id) return;
    longPressFiredRef.current = false;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      openTranslationFor(m);
    }, 450);
  }

  function handleBubblePressEnd() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function changeTargetLang(m: MessageRow, lang: string) {
    setTargetLang(lang);
    savePreferredTargetLang(lang);
    void runTranslate(m, lang, true);
  }

  // Mesajele din outbox (pending/failed) apar în listă la finalul conversației,
  // marcate cu _status ca să obțină chip-ul "sending" / "failed · tap to retry".
  const outboxAsMessages: UiMessage[] = user
    ? outbox.map((o) => ({
        id: `outbox-${o.client_id}`,
        conversation_id: o.conversation_id,
        sender_id: user.id,
        body: o.body,
        read_at: null,
        created_at: o.created_at,
        reply_to_id: o.reply_to_id,
        _status: o.status === "failed" ? "failed" : "pending",
      }))
    : [];
  const renderedMessages: UiMessage[] = [...messages, ...outboxAsMessages];

  return (

    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-3 py-3 backdrop-blur">
        <Link
          to="/messages"
          className="rounded-full p-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        {other?.profile_slug ? (
          <Link
            to="/u/$slug"
            params={{ slug: other.profile_slug }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-full pr-2 hover:bg-muted/40"
            aria-label={`Deschide profilul ${other?.name ?? ""}`}
          >
            <div className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
              {other?.photo ? (
                <img src={other.photo} alt="" className="size-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold">
                {other?.name ?? "…"}
                {other?.verified && (
                  <span title="Acest cont este verificat" className="inline-flex">
                    <BadgeCheck
                      className="size-3.5 shrink-0 text-primary"
                      aria-label="Acest cont este verificat"
                    />
                  </span>
                )}


              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {otherTyping ? (
                  <span className="text-primary">typing…</span>
                ) : connected ? (
                  "online"
                ) : (
                  "reconnecting…"
                )}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
              {other?.photo ? (
                <img src={other.photo} alt="" className="size-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold">
                {other?.name ?? "…"}
                {other?.verified && (
                  <span title="Acest cont este verificat" className="inline-flex">
                    <BadgeCheck
                      className="size-3.5 shrink-0 text-primary"
                      aria-label="Acest cont este verificat"
                    />
                  </span>
                )}

              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {otherTyping ? (
                  <span className="text-primary">typing…</span>
                ) : connected ? (
                  "online"
                ) : (
                  "reconnecting…"
                )}
              </p>
            </div>
          </div>
        )}
        <input
          ref={selfieInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleVerifyFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (other?.verified) {
              toast.success("Acest cont este verificat ✓", {
                description: "Ventuza a confirmat identitatea acestei persoane.",
              });
            } else {
              toast.message("Cont neverificat", {
                description:
                  "Această persoană nu are încă badge-ul de verificare. Fii precaut și folosește pagina „Siguranță”.",
              });
            }
          }}
          aria-label={other?.verified ? "Cont verificat" : "Cont neverificat"}
          className={cn(
            "flex size-9 items-center justify-center rounded-full transition-colors",
            other?.verified
              ? "bg-primary/15 text-primary"
              : "border border-border bg-muted text-muted-foreground hover:text-foreground",
          )}
          title={other?.verified ? "Acest cont este verificat" : "Cont neverificat"}
        >
          {other?.verified ? (
            <BadgeCheck className="size-4" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
        </button>
        {other?.id && (
          <ReportBlockDialog
            targetUserId={other.id}
            targetName={other.name ?? undefined}
            onBlocked={() => navigate({ to: "/messages" })}
            trigger={
              <button
                className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                aria-label="Opțiuni"
              >
                <MoreVertical className="size-5" />
              </button>
            }
          />
        )}
      </header>


      <MessagesScroller
        loading={loading}
        loadingMore={loadingMore}
        messages={renderedMessages}
        otherName={other?.name ?? null}
        otherTyping={otherTyping}
        scrollerRef={scrollerRef}
        onScroll={onScroll}
        onReachTop={() => {
          if (hasMore && !loadingMore) void loadMore();
        }}
        renderRow={(m) => {
          const mine = m.sender_id === user?.id;
          const translated = translations[m.id];
          const replied = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
          const canUnsend =
            mine &&
            !m.deleted_at &&
            Date.now() - new Date(m.created_at).getTime() < 5 * 60_000;
          const isDeleted = !!m.deleted_at;
          return (
            <li
              key={m.id}
              className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
            >
              <SwipeToReply
                onReply={() => setReplyTo(m)}
                disabled={isDeleted}
                align={mine ? "right" : "left"}
              >
              <div
                className={cn(
                  "group relative flex w-full items-end gap-1",
                  mine ? "justify-end" : "justify-start",
                )}
              >
                {!mine && !isDeleted && (
                  <div className="order-2 mb-1 hidden gap-1 group-hover:flex">
                    <button
                      type="button"
                      onClick={() => setReplyTo(m)}
                      aria-label="Reply"
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <CornerUpLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)
                      }
                      aria-label="React"
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Smile className="size-3.5" />
                    </button>
                  </div>
                )}
                <div
                  className={cn(
                    "order-1 max-w-[82%] select-none",
                    m._status === "pending" && "opacity-70",
                    m._status === "failed" && "rounded-2xl ring-1 ring-destructive/60",
                    heartPulseFor === m.id && "animate-in zoom-in-95 duration-300",
                  )}
                  onDoubleClick={() => quickLike(m)}
                  onClick={() => {
                    if (longPressFiredRef.current) {
                      longPressFiredRef.current = false;
                      return;
                    }
                    handleBubbleTap(m);
                  }}
                  onTouchStart={() => handleBubblePressStart(m)}
                  onTouchEnd={handleBubblePressEnd}
                  onTouchCancel={handleBubblePressEnd}
                  onMouseDown={() => handleBubblePressStart(m)}
                  onMouseUp={handleBubblePressEnd}
                  onMouseLeave={handleBubblePressEnd}
                  onContextMenu={(e) => {
                    if (m.body && !m.deleted_at && m.sender_id !== user?.id) {
                      e.preventDefault();
                      openTranslationFor(m);
                    }
                  }}
                >
                  {replied && !isDeleted && (
                    <div
                      className={cn(
                        "mb-1 rounded-xl border-l-2 px-2 py-1 text-[11px]",
                        mine
                          ? "border-primary-foreground/40 bg-primary/20 text-primary-foreground/80"
                          : "border-primary/40 bg-muted text-muted-foreground",
                      )}
                    >
                      <p className="truncate font-medium opacity-80">
                        ↩ {replied.sender_id === user?.id ? "Tu" : (other?.name ?? "…")}
                      </p>
                      <p className="line-clamp-2 opacity-90">
                        {replied.deleted_at
                          ? "Mesaj șters"
                          : replied.body ||
                            (replied.media_type === "image"
                              ? "📷 Photo"
                              : replied.media_type === "audio"
                                ? "🎤 Voice"
                                : replied.media_type === "location"
                                  ? "📍 Location"
                                  : "")}
                      </p>
                    </div>
                  )}
                  {isDeleted ? (
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-2xl border border-dashed px-3 py-2 text-xs italic",
                        mine
                          ? "border-primary-foreground/30 bg-primary/30 text-primary-foreground/80"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      <Trash2 className="size-3" /> Mesaj șters
                    </div>
                  ) : (
                    <ChatMediaBubble m={m} mine={mine} />
                  )}
                </div>
                {mine && !isDeleted && (
                  <div className="order-0 mb-1 hidden gap-1 group-hover:flex">
                    {canUnsend && (
                      <button
                        type="button"
                        onClick={() => setUnsendTarget(m)}
                        aria-label="Unsend"
                        className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReplyTo(m)}
                      aria-label="Reply"
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <CornerUpLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)
                      }
                      aria-label="React"
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Smile className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
              </SwipeToReply>
              {reactionPickerFor === m.id && (
                <div
                  className={cn(
                    "flex gap-1 rounded-full border border-border bg-background px-2 py-1.5 shadow-lg",
                    mine ? "self-end" : "self-start",
                  )}
                >
                  {REACTION_EMOJIS.map((e) => {
                    const active = user && (m.reactions?.[e] ?? []).includes(user.id);
                    return (
                      <button
                        key={e}
                        onClick={() => handleReact(m.id, e)}
                        className={cn(
                          "text-base transition-transform hover:scale-125",
                          active && "scale-110",
                        )}
                      >
                        {e}
                      </button>
                    );
                  })}
                </div>
              )}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <div
                  className={cn(
                    "-mt-1 flex flex-wrap gap-1",
                    mine ? "self-end" : "self-start",
                  )}
                >
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
                    <>
                      <Clock className="size-3" /> sending
                    </>
                  ) : m._status === "failed" ? (
                    <button
                      onClick={() => retryFailed(m)}
                      className="inline-flex items-center gap-1 text-destructive"
                    >
                      <AlertCircle className="size-3" /> failed · tap to retry
                    </button>
                  ) : m.read_at ? (
                    <>
                      <CheckCheck className="size-3 text-primary" /> read
                    </>
                  ) : (
                    <>
                      <Check className="size-3" /> sent
                    </>
                  )}
                </div>
              )}
              {!mine &&
                m.body &&
                m.media_type !== "audio" &&
                m.media_type !== "image" &&
                m.media_type !== "location" &&
                (translateOpenFor === m.id || translated ? (
                  <div className="w-full max-w-[82%] rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Languages className="size-3" />
                        {translated
                          ? `${langLabel(translated.detected)} → ${langLabel(translated.target)}`
                          : "Traducere…"}
                      </span>
                      <div className="flex items-center gap-1">
                        <select
                          value={translated?.target ?? targetLang}
                          onChange={(e) => changeTargetLang(m, e.target.value)}
                          disabled={translatingId === m.id}
                          className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                          aria-label="Limbă țintă"
                        >
                          {CHAT_TARGET_LANGS.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.native}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setTranslateOpenFor(null)}
                          className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                          aria-label="Închide"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </div>
                    </div>
                    {translatingId === m.id && !translated ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Se traduce…
                      </div>
                    ) : translated ? (
                      <p className="whitespace-pre-wrap text-foreground">{translated.translation}</p>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openTranslationFor(m)}
                    disabled={translatingId === m.id}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                  >
                    {translatingId === m.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Languages className="size-3" />
                    )}
                    Traduce · ține apăsat
                  </button>
                ))}
            </li>
          );
        }}
      />


      {openers && openers.length > 0 && (
        <div className="border-t border-border/60 bg-surface/60 px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-primary">Wingman AI</p>
            <button onClick={() => setOpeners(null)} className="text-xs text-muted-foreground">
              ×
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {openers.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setText(o);
                  setOpeners(null);
                }}
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
            <p className="text-[11px] font-medium text-primary">
              Răspunde la {replyTo.sender_id === user?.id ? "tine" : (other?.name ?? "…")}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {replyTo.deleted_at ? "Mesaj șters" : replyTo.body || "📎 media"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {blockedFirstMessage && (
        <div className="border-t border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">Nu poți trimite mesaje acestui utilizator</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Există un blocaj între voi (de la tine sau de la cealaltă persoană). Conversația este
            doar pentru lectură.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 flex items-center gap-2 border-t border-border/60 bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
      >
        <button
          type="button"
          onClick={handleWingman}
          disabled={wingmanLoading || blockedFirstMessage}
          aria-label="Wingman AI"
          className="flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary disabled:opacity-50"
        >
          {wingmanLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </button>
        <ChatComposerExtras
          conversationId={id}
          disabled={blockedFirstMessage}
          onSent={(m) =>
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
          }
          onUpdated={(m) =>
            setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
          }
        />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            sendTypingPing();
          }}
          placeholder={
            blockedFirstMessage ? "Nu poți trimite mesaje acestui utilizator" : "Type a message…"
          }
          maxLength={4000}
          disabled={blockedFirstMessage}
          className="flex-1 rounded-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!text.trim() || blockedFirstMessage}
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>

      <AlertDialog open={!!unsendTarget} onOpenChange={(o) => !o && setUnsendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge mesajul?</AlertDialogTitle>
            <AlertDialogDescription>
              Mesajul va fi șters pentru ambele părți. Acțiune disponibilă doar în primele 5 minute.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Renunță</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnsend}>Șterge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const VIRTUALIZATION_THRESHOLD = 100;

function MessagesScroller({
  loading,
  loadingMore,
  messages,
  otherName,
  otherTyping,
  scrollerRef,
  onScroll,
  onReachTop,
  renderRow,
}: {
  loading: boolean;
  loadingMore: boolean;
  messages: UiMessage[];
  otherName: string | null;
  otherTyping: boolean;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onReachTop: () => void;
  renderRow: (m: UiMessage) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const virtualHandle = useRef<VirtualizedMessagesHandle>(null);
  const prevLenRef = useRef(messages.length);
  const prevFirstIdRef = useRef<string | null>(messages[0]?.id ?? null);
  const virtualize = messages.length >= VIRTUALIZATION_THRESHOLD;

  useEffect(() => {
    if (!virtualize) return;
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtualize]);

  // Preserve top anchor when older messages are prepended in virtualized mode.
  useEffect(() => {
    if (!virtualize) return;
    const currFirstId = messages[0]?.id ?? null;
    const prevFirstId = prevFirstIdRef.current;
    if (currFirstId && prevFirstId && currFirstId !== prevFirstId) {
      // A prepend happened → keep visible position roughly stable.
      virtualHandle.current?.remeasure(0);
    }
    prevFirstIdRef.current = currFirstId;
    prevLenRef.current = messages.length;
  }, [messages, virtualize]);

  if (virtualize) {
    return (
      <div ref={containerRef} className="relative flex-1 overflow-hidden px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Say something nice to {otherName ?? "them"}.
          </p>
        ) : containerHeight > 0 ? (
          <>
            {loadingMore && (
              <div className="pointer-events-none absolute left-0 right-0 top-2 z-10 flex justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            <VirtualizedMessages<UiMessage>
              ref={virtualHandle}
              items={messages}
              keyFor={(m) => m.id}
              height={containerHeight}
              estimatedItemHeight={72}
              renderItem={(m) => renderRow(m)}
              onReachTop={onReachTop}
              stickToBottom
              prevLength={prevLenRef.current}
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef as React.RefObject<HTMLDivElement>}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-4 py-4"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Say something nice to {otherName ?? "them"}.
        </p>
      ) : (
        <>
          {loadingMore && (
            <div className="flex justify-center py-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
          <ul className="space-y-2">
            {messages.map((m) => renderRow(m))}
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
  );
}

