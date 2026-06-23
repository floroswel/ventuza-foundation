import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, LogOut, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/groups/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Squad — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: GroupChatPage,
});

type GroupRow = { id: string; name: string; description: string | null; member_count: number; owner_id: string };
type Msg = { id: string; group_id: string; sender_id: string; body: string | null; media_type: string; media_url: string | null; created_at: string };
type Member = { user_id: string; display_name: string | null };

function GroupChatPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [isMember, setIsMember] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: g }, { data: mems }, { data: msgs }] = await Promise.all([
        supabase.from("groups").select("*").eq("id", id).maybeSingle(),
        supabase.from("group_members").select("user_id").eq("group_id", id),
        supabase.from("group_messages").select("*").eq("group_id", id).order("created_at", { ascending: true }).limit(200),
      ]);
      if (cancelled) return;
      setGroup((g ?? null) as GroupRow | null);
      const memberIds = ((mems ?? []) as { user_id: string }[]).map((m) => m.user_id);
      setIsMember(memberIds.includes(user.id));
      if (memberIds.length) {
        const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: memberIds });
        const map: Record<string, Member> = {};
        for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
          map[p.id] = { user_id: p.id, display_name: p.display_name };
        }
        setMembers(map);
      }
      setMessages((msgs ?? []) as Msg[]);
      setLoading(false);
      requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight }));
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  // realtime
  useEffect(() => {
    if (!user || !isMember) return;
    const ch = supabase
      .channel(`group:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` }, (payload) => {
        const m = payload.new as Msg;
        setMessages((prev) => prev.find((x) => x.id === m.id) ? prev : [...prev, m]);
        requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user, isMember]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const body = text.trim().slice(0, 2000);
    setText("");
    const { error } = await supabase.from("group_messages").insert({
      group_id: id, sender_id: user.id, body, media_type: "text",
    });
    if (error) toast.error(error.message);
  }

  async function leave() {
    if (!user) return;
    if (!confirm("Părăsești squad-ul?")) return;
    const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Ai părăsit squad-ul.");
    navigate({ to: "/groups" });
  }

  if (loading) return <main className="flex min-h-dvh items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></main>;
  if (!group) return <main className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">Squad inexistent.</main>;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/60 bg-background/95 px-3 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate({ to: "/groups" })} className="text-muted-foreground hover:text-foreground" aria-label="Back"><ChevronLeft className="size-5" /></button>
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"><Users className="size-4" /></div>
          <div>
            <p className="text-sm font-medium leading-tight">{group.name}</p>
            <p className="text-xs text-muted-foreground">{group.member_count} {group.member_count === 1 ? "membru" : "membri"}</p>
          </div>
        </div>
        {isMember && (
          <button onClick={leave} aria-label="Leave" className="text-muted-foreground hover:text-destructive"><LogOut className="size-4" /></button>
        )}
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-4">
        {!isMember ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <p>Nu ești membru. Alătură-te ca să citești și să scrii.</p>
            <Button variant="hero" size="sm" onClick={async () => {
              if (!user) return;
              const { error } = await supabase.from("group_members").insert({ group_id: id, user_id: user.id, role: "member" });
              if (error) return toast.error(error.message);
              setIsMember(true);
            }}>Alătură-te</Button>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Niciun mesaj încă. Spune salut! 👋</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const mine = user && m.sender_id === user.id;
              const name = members[m.sender_id]?.display_name ?? "Cineva";
              return (
                <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  {!mine && <span className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground">{name}</span>}
                  <div className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                    mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md",
                  )}>
                    {m.body}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isMember && (
        <form onSubmit={handleSend} className="sticky bottom-0 flex items-center gap-2 border-t border-border/60 bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mesaj pentru squad…"
            maxLength={2000}
            className="flex-1 rounded-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button type="submit" disabled={!text.trim()} className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
            <Send className="size-4" />
          </button>
        </form>
      )}
    </div>
  );
}
