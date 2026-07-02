import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  EyeOff,
  Flame,
  Loader2,
  LogOut,
  Mail,
  Megaphone,
  ShieldOff,
  Shield,
  Star,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { BottomNav } from "@/components/BottomNav";
import { setLookingNow } from "@/lib/social";
import { UniquesCard } from "@/components/UniquesCard";
import { SosCard } from "@/components/SosCard";
import { EnablePushButton } from "@/components/EnablePushButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ReferralCard } from "@/components/ReferralCard";
import { ConsentsCard } from "@/components/settings/ConsentsCard";
import { ProximityNotificationsCard } from "@/components/settings/ProximityNotificationsCard";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Setări — Ventuza" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

type Prefs = {
  matches: boolean;
  messages: boolean;
  likes: boolean;
  events: boolean;
  marketing: boolean;
  master_push: boolean;
  quiet_enabled: boolean;
  quiet_start: number;
  quiet_end: number;
};
const DEFAULT_PREFS: Prefs = {
  matches: true,
  messages: true,
  likes: true,
  events: true,
  marketing: false,
  master_push: true,
  quiet_enabled: false,
  quiet_start: 23,
  quiet_end: 7,
};

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
  const [privacy, setPrivacy] = useState({
    hide_age: false,
    hide_distance: false,
    hide_online: false,
    read_receipts_enabled: true,
    auto_share_album_on_match: false,
    discrete_mode: false,
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [lookingUntil, setLookingUntil] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [busyNow, setBusyNow] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    // Keep tz offset in sync with the device so quiet hours line up with local time.
    // (Date#getTimezoneOffset returns minutes to add to local to get UTC, so negate.)
    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    void supabase.from("profiles").update({ tz_offset_minutes: tzOffsetMinutes }).eq("id", user.id);
    supabase
      .from("profiles")
      .select(
        "notification_prefs, hide_age, hide_distance, hide_online, looking_now_until, looking_now_intent, read_receipts_enabled, auto_share_album_on_match, discrete_mode",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.notification_prefs)
          setPrefs({ ...DEFAULT_PREFS, ...(data.notification_prefs as Prefs) });
        const d = data as {
          hide_age?: boolean;
          hide_distance?: boolean;
          hide_online?: boolean;
          read_receipts_enabled?: boolean;
          auto_share_album_on_match?: boolean;
          looking_now_until?: string | null;
          looking_now_intent?: string | null;
          discrete_mode?: boolean;
        };
        setPrivacy({
          hide_age: !!d.hide_age,
          hide_distance: !!d.hide_distance,
          hide_online: !!d.hide_online,
          read_receipts_enabled: d.read_receipts_enabled ?? true,
          auto_share_album_on_match: !!d.auto_share_album_on_match,
          discrete_mode: !!d.discrete_mode,
        });
        setLookingUntil(d.looking_now_until ?? null);
        setIntent(d.looking_now_intent ?? "");
      });
  }, [user]);

  async function savePrivacy(next: typeof privacy) {
    if (!user) return;
    setPrivacy(next);
    setSavingPrivacy(true);
    const { error } = await supabase.from("profiles").update(next).eq("id", user.id);
    setSavingPrivacy(false);
    if (error) toast.error(error.message);
  }

  async function activateLookingNow(hours: number) {
    setBusyNow(true);
    try {
      await setLookingNow(hours, intent || undefined);
      if (hours > 0) {
        const until = new Date(Date.now() + hours * 3600_000).toISOString();
        setLookingUntil(until);
        toast.success(`Activ pentru ${hours}h`);
      } else {
        setLookingUntil(null);
        toast.success("Dezactivat");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyNow(false);
    }
  }

  async function savePrefs(next: Prefs) {
    if (!user) return;
    setPrefs(next);
    setSavingPrefs(true);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: next })
      .eq("id", user.id);
    setSavingPrefs(false);
    if (error) toast.error(error.message);
  }

  async function changeEmail() {
    if (!newEmail) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) toast.error(error.message);
    else {
      toast.success("Verifică inbox-ul pentru confirmare.");
      setNewEmail("");
    }
  }

  async function changePassword() {
    if (newPwd.length < 8) {
      toast.error("Min. 8 caractere.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) toast.error(error.message);
    else {
      toast.success("Parolă actualizată.");
      setNewPwd("");
    }
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
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          to="/profile"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-base font-semibold">Setări</h1>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        <LanguageSwitcher />
        <ReferralCard />

        {/* Account */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Cont
          </h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Email curent</label>
              <p className="text-sm">{email}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Schimbă email</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nou@email.com"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={changeEmail}
                  className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  Salvează
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Parolă nouă</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="min. 8 caractere"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={changePassword}
                  className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  Schimbă
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <button
              onClick={downloadMyData}
              className="w-full rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-surface"
            >
              📥 Exportă datele mele (GDPR)
            </button>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Primești un fișier JSON cu toate datele tale: profil, swipes, matches, mesaje,
              RSVP-uri, abonamente.
            </p>
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Notificări {savingPrefs && <Loader2 className="ml-2 inline size-3 animate-spin" />}
          </h2>

          {/* Master toggle */}
          <label className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
            <span className="font-medium">Notificări push (general)</span>
            <input
              type="checkbox"
              checked={prefs.master_push}
              onChange={(e) => savePrefs({ ...prefs, master_push: e.target.checked })}
              className="size-4 accent-primary"
            />
          </label>

          <div
            className={`mt-3 divide-y divide-border ${prefs.master_push ? "" : "pointer-events-none opacity-50"}`}
          >
            {(
              [
                ["matches", "Match-uri noi"],
                ["messages", "Mesaje noi"],
                ["likes", "Like-uri primite"],
                ["events", "Evenimente"],
                ["marketing", "Newsletter & oferte"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between py-2.5 text-sm">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => savePrefs({ ...prefs, [key]: e.target.checked })}
                  className="size-4 accent-primary"
                />
              </label>
            ))}
          </div>

          {/* Quiet hours */}
          <div className="mt-4 rounded-xl border border-border bg-background p-3">
            <label className="flex items-center justify-between text-sm">
              <span className="font-medium">Ore liniștite (Do Not Disturb)</span>
              <input
                type="checkbox"
                checked={prefs.quiet_enabled}
                onChange={(e) => savePrefs({ ...prefs, quiet_enabled: e.target.checked })}
                className="size-4 accent-primary"
              />
            </label>
            {prefs.quiet_enabled && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">
                  De la
                  <select
                    value={prefs.quiet_start}
                    onChange={(e) => savePrefs({ ...prefs, quiet_start: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Până la
                  <select
                    value={prefs.quiet_end}
                    onChange={(e) => savePrefs({ ...prefs, quiet_end: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Nu primești push-uri în acest interval (ora ta locală). Mesajele rămân în aplicație.
            </p>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <p className="text-[11px] text-muted-foreground mb-2">
              Notificări push pe acest dispozitiv (mesaje, taps, woofs, match-uri).
            </p>
            <EnablePushButton />
          </div>
        </section>

        {/* Right Now */}
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">
            <Flame className="size-4" /> Right Now
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Anunță că ești disponibil acum. Profilul tău apare evidențiat în Discover.
          </p>
          {lookingUntil && new Date(lookingUntil) > new Date() ? (
            <p className="mt-2 text-xs text-rose-200">
              ⚡ Activ până la{" "}
              {new Date(lookingUntil).toLocaleTimeString("ro-RO", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
          <input
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="Ce cauți acum? (opțional, max. 80)"
            maxLength={80}
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-rose-400"
          />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[1, 2, 4, 8].map((h) => (
              <button
                key={h}
                disabled={busyNow}
                onClick={() => activateLookingNow(h)}
                className="rounded-full bg-rose-500/15 px-2 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
              >
                {h}h
              </button>
            ))}
          </div>
          {lookingUntil && new Date(lookingUntil) > new Date() && (
            <button
              disabled={busyNow}
              onClick={() => activateLookingNow(0)}
              className="mt-2 w-full rounded-full border border-border bg-background py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Dezactivează
            </button>
          )}
        </section>

        {/* Privacy */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <EyeOff className="size-4" /> Confidențialitate{" "}
            {savingPrivacy && <Loader2 className="ml-1 inline size-3 animate-spin" />}
          </h2>
          <div className="mt-3 divide-y divide-border">
            {(
              [
                ["hide_age", "Ascunde vârsta"],
                ["hide_distance", "Ascunde distanța"],
                ["hide_online", "Ascunde statusul online / „Active …"],
                ["read_receipts_enabled", "Trimite confirmări de citire (read receipts)"],
                ["auto_share_album_on_match", "Auto-share album privat la match"],
                ["discrete_mode", "Mod Discret (notificările nu arată preview)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between py-2.5 text-sm">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={privacy[key]}
                  onChange={(e) => savePrivacy({ ...privacy, [key]: e.target.checked })}
                  className="size-4 accent-primary"
                />
              </label>
            ))}
          </div>
        </section>

        {/* GDPR consents (single source of truth = src/lib/consent-registry.ts) */}
        <ConsentsCard />

        {/* Proximity notifications (Strat 1 + Strat 2 opt-in) */}
        <ProximityNotificationsCard />

        {/* Unique features: pronouns, friends-only, language, PIN, discreet mode */}
        <UniquesCard />

        {/* SOS contacts + emergency button */}
        <SosCard />

        {/* Listele mele */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Listele mele
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            <Link
              to="/favorites"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Star className="size-4" /> Profile favorite
            </Link>
            <Link
              to="/blocked"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <ShieldOff className="size-4" /> Utilizatori blocați
            </Link>
          </div>
        </section>

        {/* Pentru businessuri */}
        <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Pentru businessuri
          </h2>
          <Link
            to="/business"
            className="mt-3 flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
          >
            <Megaphone className="size-4 text-primary" /> Devino partener (locuri, evenimente,
            oferte)
          </Link>
          <Link
            to="/advertise"
            className="mt-1 flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
          >
            <Megaphone className="size-4 text-muted-foreground" /> Campanii publicitare (bannere &
            Discover)
          </Link>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Ai un club, bar sau eveniment LGBTQ-friendly? Ajunge la mii de utilizatori.
          </p>
        </section>

        {/* Legal */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Legal
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            <Link
              to="/safety"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Centrul de siguranță
            </Link>
            <Link
              to="/legal/terms"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Termeni și condiții
            </Link>
            <Link
              to="/legal/privacy"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Politica de confidențialitate
            </Link>
            <Link
              to="/legal/data-safety"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Siguranța datelor (Data Safety)
            </Link>
            <Link
              to="/legal/cookies"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Politica de cookie-uri
            </Link>
            <Link
              to="/legal/community"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Reguli comunitate
            </Link>
            <Link
              to="/legal/subprocessors"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Subprocesatori
            </Link>
            <Link
              to="/legal/dsa"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Transparență DSA
            </Link>
            <Link
              to="/legal/security-incidents"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Incidente de securitate
            </Link>
            <Link
              to="/legal/age-policy"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Politica 18+
            </Link>
            <Link
              to="/legal/dmca"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> DMCA / Drepturi de autor
            </Link>
            <Link
              to="/legal/business-terms"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Termeni B2B (advertiseri)
            </Link>

            <Link
              to="/business"
              className="flex items-center gap-2 py-1.5 text-primary hover:text-primary/80"
            >
              <Shield className="size-4" /> Devino partener B2B →
            </Link>
            <a
              href="mailto:privacy@ventuza.app"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Mail className="size-4" /> Contact privacy / DPO
            </a>
            <a
              href="mailto:support@ventuza.app"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Mail className="size-4" /> Contact suport
            </a>
          </div>
        </section>

        {/* Sign out */}
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-sm font-medium hover:bg-surface-elevated"
        >
          <LogOut className="size-4" /> Deconectare
        </button>

        {/* Delete account */}
        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
            <Trash2 className="size-3.5" /> Șterge cont
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Acțiune permanentă. Profilul, pozele, mesajele, match-urile și toate datele vor fi
            șterse imediat și definitiv. Scrie <strong className="text-foreground">ȘTERGE</strong>{" "}
            pentru a confirma.
          </p>
          <input
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder="ȘTERGE"
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-destructive"
          />
          <button
            onClick={handleDelete}
            disabled={confirmDelete !== "ȘTERGE" || deleting}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-50"
          >
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            Șterge contul definitiv
          </button>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
