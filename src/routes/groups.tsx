import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/groups")({
  ssr: false,
  head: () => ({ meta: [{ title: "Squads — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: GroupsPage,
});

type Group = {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  is_public: boolean;
  owner_id: string;
};

function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Group[]>([]);
  const [discover, setDiscover] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    const { data: memberRows } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);
    const myIds = (memberRows ?? []).map((r) => r.group_id);
    const { data: mineGroups } = myIds.length
      ? await supabase.from("groups").select("*").in("id", myIds).order("created_at", { ascending: false })
      : { data: [] as Group[] };
    setMine((mineGroups ?? []) as Group[]);

    const { data: pub } = await supabase
      .from("groups")
      .select("*")
      .eq("is_public", true)
      .order("member_count", { ascending: false })
      .limit(30);
    setDiscover(((pub ?? []) as Group[]).filter((g) => !myIds.includes(g.id)));
    setLoading(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [user]);

  async function join(g: Group) {
    if (!user) return;
    const { error } = await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id, role: "member" });
    if (error) return toast.error(error.message);
    toast.success(`Te-ai alăturat ${g.name}`);
    refresh();
  }

  return (
    <main className="min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate({ to: "/discover" })} className="text-muted-foreground hover:text-foreground" aria-label="Back">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="wordmark text-lg">Squads</h1>
        <button onClick={() => setCreating(true)} aria-label="New squad" className="rounded-full bg-primary p-1.5 text-primary-foreground">
          <Plus className="size-4" />
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-8 px-4 py-6">
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Squads tale</h2>
            {mine.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
                N-ai squad-uri încă. Creează unul sau alătură-te mai jos.
              </p>
            ) : (
              <ul className="space-y-2">
                {mine.map((g) => <GroupCard key={g.id} g={g} action={<Button size="sm" variant="hero" onClick={() => navigate({ to: "/groups/$id", params: { id: g.id } })}>Deschide</Button>} />)}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Descoperă</h2>
            {discover.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun squad public momentan.</p>
            ) : (
              <ul className="space-y-2">
                {discover.map((g) => <GroupCard key={g.id} g={g} action={<Button size="sm" variant="subtle" onClick={() => join(g)}>Alătură-te</Button>} />)}
              </ul>
            )}
          </section>
        </div>
      )}

      {creating && user && (
        <CreateGroupDrawer
          userId={user.id}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); refresh(); navigate({ to: "/groups/$id", params: { id } }); }}
        />
      )}
      <BottomNav />
    </main>
  );
}

function GroupCard({ g, action }: { g: Group; action: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Users className="size-5" />
        </div>
        <div>
          <p className="font-medium">{g.name}</p>
          <p className="text-xs text-muted-foreground">{g.member_count} {g.member_count === 1 ? "membru" : "membri"}{g.description ? ` • ${g.description.slice(0, 40)}` : ""}</p>
        </div>
      </div>
      {action}
    </li>
  );
}

function CreateGroupDrawer({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) return toast.error("Numele este obligatoriu");
    setSaving(true);
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: name.trim().slice(0, 80), description: description.trim().slice(0, 280) || null, is_public: isPublic, owner_id: userId })
      .select("id")
      .single();
    if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Eroare"); }
    await supabase.from("group_members").insert({ group_id: data.id, user_id: userId, role: "owner" });
    setSaving(false);
    onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <button onClick={onClose} className="text-muted-foreground">Renunță</button>
        <h2 className="font-display text-lg">Squad nou</h2>
        <Button onClick={create} variant="hero" size="sm" disabled={saving}>
          {saving && <Loader2 className="size-3 animate-spin" />} Creează
        </Button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        <div className="space-y-2">
          <Label>Nume</Label>
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="h-12 bg-surface border-border" placeholder="Ex: Bucharest Bears" />
        </div>
        <div className="space-y-2">
          <Label>Descriere</Label>
          <Textarea value={description} maxLength={280} rows={4} onChange={(e) => setDescription(e.target.value)} className="bg-surface border-border" placeholder="Despre ce e squad-ul?" />
        </div>
        <label className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
          <div>
            <p className="text-sm font-medium">Public</p>
            <p className="text-xs text-muted-foreground">Oricine îl poate găsi și se poate alătura.</p>
          </div>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="size-5 accent-primary" />
        </label>
      </div>
    </div>
  );
}
