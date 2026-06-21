import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, EyeOff, Flame, Loader2, LogOut, Mail, ShieldOff, Shield, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { BottomNav } from "@/components/BottomNav";
import { setLookingNow } from "@/lib/social";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Setări — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

type Prefs = { matches: boolean; messages: boolean; likes: boolean; events: boolean; marketing: boolean };
const DEFAULT_PREFS: Prefs = { matches: true, messages: true, likes: true, events: true, marketing: false };

function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const deleteAcct = useServerFn(deleteMyAccount);
  const exportData = useServerFn(exportMyData);

  async function downloadMyData() {
    try {
      const data = await exportData({});
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventuza-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Datele tale au fost exportate (GDPR)");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    supabase.from("profiles").select("notification_prefs").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.notification_prefs) setPrefs({ ...DEFAULT_PREFS, ...(data.notification_prefs as Prefs) });
      });
  }, [user]);

  async function savePrefs(next: Prefs) {
    if (!user) return;
    setPrefs(next);
    setSavingPrefs(true);
    const { error } = await supabase.from("profiles").update({ notification_prefs: next }).eq("id", user.id);
    setSavingPrefs(false);
    if (error) toast.error(error.message);
  }

  async function changeEmail() {
    if (!newEmail) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) toast.error(error.message);
    else { toast.success("Verifică inbox-ul pentru confirmare."); setNewEmail(""); }
  }

  async function changePassword() {
    if (newPwd.length < 8) { toast.error("Min. 8 caractere."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) toast.error(error.message);
    else { toast.success("Parolă actualizată."); setNewPwd(""); }
  }

  async function handleDelete() {
    if (confirmDelete !== "ȘTERGE") return;
    setDeleting(true);
    try {
      await deleteAcct({});
      await signOut();
      toast.success("Cont șters.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare la ștergere");
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/profile" className="flex size-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Setări</h1>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        {/* Account */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Cont</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Email curent</label>
              <p className="text-sm">{email}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Schimbă email</label>
              <div className="mt-1 flex gap-2">
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nou@email.com"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                <button onClick={changeEmail} className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
                  Salvează
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Parolă nouă</label>
              <div className="mt-1 flex gap-2">
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="min. 8 caractere"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                <button onClick={changePassword} className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
                  Schimbă
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <button onClick={downloadMyData} className="w-full rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-surface">
              📥 Exportă datele mele (GDPR)
            </button>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Primești un fișier JSON cu toate datele tale: profil, swipes, matches, mesaje, RSVP-uri, abonamente.
            </p>
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Notificări {savingPrefs && <Loader2 className="ml-2 inline size-3 animate-spin" />}
          </h2>
          <div className="mt-3 divide-y divide-border">
            {([
              ["matches", "Match-uri noi"],
              ["messages", "Mesaje noi"],
              ["likes", "Like-uri primite"],
              ["events", "Evenimente"],
              ["marketing", "Newsletter & oferte"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between py-2.5 text-sm">
                <span>{label}</span>
                <input type="checkbox" checked={prefs[key]} onChange={(e) => savePrefs({ ...prefs, [key]: e.target.checked })}
                  className="size-4 accent-primary" />
              </label>
            ))}
          </div>
        </section>

        {/* Legal */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Legal</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Link to="/safety" className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary">
              <Shield className="size-4" /> Centrul de siguranță</Link>
            <Link to="/legal/terms" className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary">
              <Shield className="size-4" /> Termeni și condiții
            </Link>
            <Link to="/legal/privacy" className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary">
              <Shield className="size-4" /> Politica de confidențialitate
            </Link>
            <a href="mailto:support@ventuza.app" className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary">
              <Mail className="size-4" /> Contact suport
            </a>
          </div>
        </section>

        {/* Sign out */}
        <button onClick={async () => { await signOut(); navigate({ to: "/" }); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-sm font-medium hover:bg-surface-elevated">
          <LogOut className="size-4" /> Deconectare
        </button>

        {/* Delete account */}
        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
            <Trash2 className="size-3.5" /> Șterge cont
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Acțiune permanentă. Profilul, pozele, mesajele, match-urile și toate datele vor fi șterse imediat și definitiv.
            Scrie <strong className="text-foreground">ȘTERGE</strong> pentru a confirma.
          </p>
          <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder="ȘTERGE"
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-destructive" />
          <button onClick={handleDelete} disabled={confirmDelete !== "ȘTERGE" || deleting}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-50">
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            Șterge contul definitiv
          </button>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
