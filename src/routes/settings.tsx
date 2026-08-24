import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Download,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  useNotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "@/lib/notification-prefs-context";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { BottomNav } from "@/components/BottomNav";
import { setLookingNow } from "@/lib/social";
import { setIncognito } from "@/lib/incognito";

import { UniquesCard } from "@/components/UniquesCard";
import { SosCard } from "@/components/SosCard";
import { EnablePushButton } from "@/components/EnablePushButton";

import { ReferralCard } from "@/components/ReferralCard";
import { PublicLinkCard } from "@/components/settings/PublicLinkCard";
import { AmbassadorWelcomeCard } from "@/components/AmbassadorWelcomeCard";
import { ConsentsCard } from "@/components/settings/ConsentsCard";
import { ConsentsHistoryCard } from "@/components/settings/ConsentsHistoryCard";
import { ProximityNotificationsCard } from "@/components/settings/ProximityNotificationsCard";
import { NotificationSoundCard } from "@/components/settings/NotificationSoundCard";
import { DebugModeCard } from "@/components/settings/DebugModeCard";
import { withGuardian } from "@/components/with-guardian";
import { getMotionPref, setMotionPref, type MotionPref } from "@/lib/motion-pref";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Setări — Suzeta" }, { name: "robots", content: "noindex" }] }),
  component: withGuardian("settings", SettingsPage),
});

// Structura preferințelor este definită canonic în notification-prefs-context.
type Prefs = NotificationPrefs;
const DEFAULT_PREFS: Prefs = DEFAULT_NOTIFICATION_PREFS;


function SettingsPage() {
  const [motionPref, setMotionPrefState] = useState<MotionPref>(() => getMotionPref());
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const deleteAcct = useServerFn(deleteMyAccount);
  const exportData = useServerFn(exportMyData);
  // Sursa unică pentru preferințele de notificări + discrete mode. Se
  // hidratează la login și se actualizează în realtime în toate suprafețele
  // (inbox, toast) fără refresh.
  const {
    prefs,
    discreteMode,
    updatePrefs: updatePrefsCtx,
    setDiscreteMode,
  } = useNotificationPrefs();


  type ExportState =
    | { status: "idle" }
    | { status: "running" }
    | { status: "done"; url: string; filename: string; sizeKb: number }
    | { status: "error"; message: string };
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });

  useEffect(() => {
    return () => {
      if (exportState.status === "done") URL.revokeObjectURL(exportState.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportState]);

  async function downloadMyData() {
    if (exportState.status === "running") return;
    if (exportState.status === "done") URL.revokeObjectURL(exportState.url);
    setExportState({ status: "running" });
    const toastId = toast.loading("Se pregătește exportul datelor…");
    try {
      const data = await exportData({});
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const filename = `suzeta-data-${new Date().toISOString().split("T")[0]}.json`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setExportState({
        status: "done",
        url,
        filename,
        sizeKb: Math.max(1, Math.round(blob.size / 1024)),
      });
      toast.success("Export finalizat — fișierul a fost descărcat.", { id: toastId });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Eroare necunoscută";
      setExportState({ status: "error", message });
      toast.error(`Export eșuat: ${message}`, { id: toastId });
    }
  }


  // `prefs` vine din context; păstrăm doar flag-ul de saving pentru UI.
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"warn" | "verify" | "done">("warn");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [privacy, setPrivacy] = useState({
    hide_age: false,
    hide_distance: false,
    hide_online: false,
    read_receipts_enabled: true,
    auto_share_album_on_match: false,
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
        "hide_age, hide_distance, hide_online, looking_now_until, looking_now_intent, read_receipts_enabled, auto_share_album_on_match",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as {
          hide_age?: boolean;
          hide_distance?: boolean;
          hide_online?: boolean;
          read_receipts_enabled?: boolean;
          auto_share_album_on_match?: boolean;
          looking_now_until?: string | null;
          looking_now_intent?: string | null;
        };
        setPrivacy({
          hide_age: !!d.hide_age,
          hide_distance: !!d.hide_distance,
          hide_online: !!d.hide_online,
          read_receipts_enabled: d.read_receipts_enabled ?? true,
          auto_share_album_on_match: !!d.auto_share_album_on_match,
        });
        setLookingUntil(d.looking_now_until ?? null);
        setIntent(d.looking_now_intent ?? "");
      });
  }, [user]);

  async function savePrivacy(next: typeof privacy) {
    if (!user) return;
    const wasHidden = privacy.hide_online;
    setPrivacy(next);
    setSavingPrivacy(true);
    const { error } = await supabase.from("profiles").update(next).eq("id", user.id);
    if (!error && wasHidden !== next.hide_online) {
      // Reapari/dispari instant (touch_last_seen + heartbeat).
      try {
        await setIncognito(user.id, next.hide_online);
      } catch {
        /* deja salvat mai sus */
      }
    }
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
    setSavingPrefs(true);
    try {
      // Delegăm către context: update optimistic + persist + broadcast în
      // toate suprafețele (inbox, toast) fără refresh.
      await updatePrefsCtx(next);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingPrefs(false);
    }
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
    if (deleteEmail.trim().toLowerCase() !== (user?.email ?? "").toLowerCase()) {
      setDeleteError("Emailul introdus nu corespunde contului tău.");
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAcct({});
      setDeleteStep("done");
      toast.success("Contul a fost șters definitiv.");
      setTimeout(() => {
        void (async () => {
          await signOut();
          navigate({ to: "/" });
        })();
      }, 2200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare la ștergere";
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }


  if (loading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-nav">
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
        <AmbassadorWelcomeCard />
        <ReferralCard />

        <PublicLinkCard />

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
              disabled={exportState.status === "running"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-surface disabled:opacity-60"
            >
              {exportState.status === "running" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Descarcă datele mele
            </button>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Fișier JSON structurat (Art. 20 GDPR): profil, consimțăminte, swipes, matches, mesaje
              trimise, blocări, rapoarte, evenimente, RSVP-uri, abonamente, notificări.
            </p>

            {exportState.status !== "idle" && (
              <div
                role="status"
                aria-live="polite"
                className={`mt-3 rounded-xl border p-3 text-[11px] ${
                  exportState.status === "error"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {exportState.status === "running" && (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" /> Se pregătește exportul…
                  </span>
                )}
                {exportState.status === "done" && (
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="size-3.5 text-primary" /> Export finalizat (
                      {exportState.sizeKb} KB)
                    </span>
                    <a
                      href={exportState.url}
                      download={exportState.filename}
                      className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground"
                    >
                      <Download className="size-3" /> Descarcă din nou
                    </a>
                  </div>
                )}
                {exportState.status === "error" && (
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5" /> Export eșuat: {exportState.message}
                  </span>
                )}
              </div>
            )}
          </div>

        </section>

        {/* Accesibilitate */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Accesibilitate
          </h2>
          <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
            <span>
              <span className="font-medium">Mișcare redusă</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Dezactivează micro-animările, animația de deschidere și tranzițiile
                dintre ecrane.
              </span>
            </span>
            <select
              value={motionPref}
              onChange={(e) => {
                const next = e.target.value as MotionPref;
                setMotionPrefState(next);
                setMotionPref(next);
              }}
              className="shrink-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="system">Ca în sistem</option>
              <option value="on">Pornit</option>
              <option value="off">Oprit</option>
            </select>
          </label>
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

          {/* Preview conținut mesaj — dezactivat permanent din motive de
              confidențialitate. Toate notificările afișează doar expeditorul
              + „Ai un mesaj nou”, indiferent de setări. */}
          <div className="mt-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground">
            Notificările afișează doar numele expeditorului și „Ai un mesaj nou”.
            Conținutul mesajului nu este trimis niciodată prin push, pentru
            confidențialitate.
          </div>



          <div
            className={`mt-3 divide-y divide-border ${prefs.master_push ? "" : "pointer-events-none opacity-50"}`}
          >
            {(
              [
                ["matches", "Match-uri noi"],
                ["messages", "Mesaje noi"],
                ["likes", "Like-uri primite"],
                ["taps", "Taps & Woofs"],
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
            {/* Discrete mode este propagat instant prin context — inbox + toast
                se actualizează fără refresh. */}
            <label className="flex items-center justify-between py-2.5 text-sm">
              <span>Mod Discret (notificările nu arată preview)</span>
              <input
                type="checkbox"
                checked={discreteMode}
                onChange={(e) => {
                  void setDiscreteMode(e.target.checked).catch((err) =>
                    toast.error((err as Error).message),
                  );
                }}
                className="size-4 accent-primary"
              />
            </label>
          </div>
        </section>


        {/* GDPR consents (single source of truth = src/lib/consent-registry.ts) */}
        <ConsentsCard />

        {/* Consent history — user-scoped read of consent_log via RLS */}
        <ConsentsHistoryCard />

        {/* Proximity notifications (Strat 1 + Strat 2 opt-in) */}
        <ProximityNotificationsCard />

        {/* Suzeta signature notification sound */}
        <NotificationSoundCard />

        {/* Unique features: pronouns, friends-only, language, PIN, discreet mode */}
        <UniquesCard />

        {/* SOS contacts + emergency button */}
        <SosCard />

        {/* Loguri detaliate pentru diagnostic */}
        <DebugModeCard />


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
              to="/legal/child-safety"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Child Safety (CSAE)
            </Link>
            <Link
              to="/legal/dmca"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> DMCA / Drepturi de autor
            </Link>
            <Link
              to="/legal/wallet-terms"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Regulament Portofel și recomandări
            </Link>
            <Link
              to="/legal/business-terms"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Termeni B2B (advertiseri)
            </Link>
            <Link
              to="/legal/dpa"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Shield className="size-4" /> Acord prelucrare date (DPA)
            </Link>



            <Link
              to="/business"
              className="flex items-center gap-2 py-1.5 text-primary hover:text-primary/80"
            >
              <Shield className="size-4" /> Devino partener B2B →
            </Link>
            <a
              href="mailto:privacy@suzeta.ro"
              className="flex items-center gap-2 py-1.5 text-foreground hover:text-primary"
            >
              <Mail className="size-4" /> Contact protecția datelor
            </a>
            <a
              href="mailto:support@suzeta.ro"
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
            șterse imediat și definitiv. Îți recomandăm să îți descarci întâi datele.
          </p>
          <button
            onClick={() => {
              setDeleteStep("warn");
              setDeleteError(null);
              setConfirmDelete("");
              setDeleteEmail("");
              setDeleteOpen(true);
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground"
          >
            <Trash2 className="size-3" /> Șterge contul definitiv
          </button>
        </section>

        <Dialog
          open={deleteOpen}
          onOpenChange={(o) => {
            if (deleting || deleteStep === "done") return;
            setDeleteOpen(o);
          }}
        >
          <DialogContent className="max-w-md">
            {deleteStep === "warn" && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="size-4" /> Ștergi contul definitiv?
                  </DialogTitle>
                  <DialogDescription className="text-left">
                    Se șterg: profilul, pozele, albumele private, mesajele, match-urile,
                    consimțămintele și abonamentele. Acțiunea nu poate fi anulată.
                  </DialogDescription>
                </DialogHeader>
                <button
                  onClick={() => void downloadMyData()}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium"
                >
                  <Download className="size-3.5" /> Descarcă întâi datele mele
                </button>
                <DialogFooter className="gap-2 sm:gap-2">
                  <button
                    onClick={() => setDeleteOpen(false)}
                    className="rounded-full border border-border bg-background px-4 py-2 text-xs font-medium"
                  >
                    Renunț
                  </button>
                  <button
                    onClick={() => setDeleteStep("verify")}
                    className="rounded-full bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground"
                  >
                    Continuă
                  </button>
                </DialogFooter>
              </>
            )}

            {deleteStep === "verify" && (
              <>
                <DialogHeader>
                  <DialogTitle>Verificare finală</DialogTitle>
                  <DialogDescription className="text-left">
                    Confirmă emailul contului și scrie{" "}
                    <strong className="text-foreground">ȘTERGE</strong> pentru a continua.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <input
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                    placeholder={user?.email ?? "email@exemplu.com"}
                    autoComplete="off"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-destructive"
                  />
                  <input
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    placeholder="ȘTERGE"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-destructive"
                  />
                  {deleteError && (
                    <p className="flex items-center gap-2 text-[11px] text-destructive">
                      <AlertTriangle className="size-3.5" /> {deleteError}
                    </p>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                  <button
                    onClick={() => setDeleteStep("warn")}
                    disabled={deleting}
                    className="rounded-full border border-border bg-background px-4 py-2 text-xs font-medium disabled:opacity-50"
                  >
                    Înapoi
                  </button>
                  <button
                    onClick={() => void handleDelete()}
                    disabled={confirmDelete !== "ȘTERGE" || !deleteEmail || deleting}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground disabled:opacity-50"
                  >
                    {deleting ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                    Șterge definitiv
                  </button>
                </DialogFooter>
              </>
            )}

            {deleteStep === "done" && (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto size-8 text-primary" />
                <p className="mt-3 text-sm font-medium">Contul a fost șters</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Te deconectăm și te redirecționăm către pagina principală…
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>

      <BottomNav />
    </div>
  );
}
