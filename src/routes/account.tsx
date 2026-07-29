import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Album,
  BadgeCheck,
  ChevronRight,
  Cog,
  Flame,
  HelpCircle,
  Loader2,
  Mail,
  MessageCircle,
  Rocket,
  Ticket,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Cont — Suzeta" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

type ProfileSummary = {
  display_name: string | null;
  age_status: string | null;
  photos: string[] | null;
  hide_online: boolean | null;
  discrete_mode: boolean | null;
  boost_until: string | null;
  looking_now_until: string | null;
};

function AccountPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select(
        "display_name, photos, age_status, hide_online, discrete_mode, boost_until, looking_now_until",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as ProfileSummary | null));
  }, [user]);

  async function toggle(field: "hide_online" | "discrete_mode", value: boolean) {
    if (!user || !profile) return;
    setSaving(true);
    setProfile({ ...profile, [field]: value });
    const patch = { [field]: value } as { hide_online?: boolean; discrete_mode?: boolean };
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      setProfile((p) => (p ? { ...p, [field]: !value } : p));
    }
  }

  if (authLoading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const verified = profile?.age_status === "verified";
  const pending = profile?.age_status === "pending" || profile?.age_status === "in_review";
  const rejected = profile?.age_status === "rejected";

  const online = !profile?.hide_online;
  const stealth = !!profile?.discrete_mode;
  const boostActive = profile?.boost_until && new Date(profile.boost_until).getTime() > Date.now();
  const nowActive =
    profile?.looking_now_until && new Date(profile.looking_now_until).getTime() > Date.now();

  return (
    <div className="min-h-dvh bg-background pb-28">
      {/* Header */}
      <header className="relative overflow-hidden px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/25 via-background to-background" />
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Cont</h1>
          <Link
            to="/settings"
            aria-label="Setări"
            className="grid size-10 place-items-center rounded-full border border-border/60 bg-background/60 backdrop-blur"
          >
            <Cog className="size-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4">
        {/* Identity */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-surface/40 p-3">
          <Link
            to="/profile"
            aria-label="Profilul meu"
            className="flex min-w-0 flex-1 items-center gap-4 rounded-xl transition-transform active:scale-[0.98]"
          >
            <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-primary/30">
              {profile?.photos?.[0] ? (
                <img src={profile.photos[0]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-2xl">
                  {(profile?.display_name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              {verified && (
                <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-emerald-500 ring-2 ring-background">
                  <BadgeCheck className="size-3 text-white" />
                </span>
              )}
              {pending && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-amber-500 ring-2 ring-background"
                  aria-label="Verificare în curs"
                >
                  <Loader2 className="size-3 animate-spin text-white" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">
                {profile?.display_name ?? user.email?.split("@")[0]}
              </p>
              {verified ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400">
                  <BadgeCheck className="size-3.5" /> Verificat
                </p>
              ) : pending ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                  <Loader2 className="size-3.5 animate-spin" /> Verificare în curs
                </p>
              ) : rejected ? (
                <p className="mt-1 text-xs text-rose-400">Verificare respinsă — reîncearcă</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Cont neverificat</p>
              )}
            </div>
          </Link>
          {verified ? (
            <ChevronRight className="size-4 text-muted-foreground" />
          ) : pending ? (
            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              În curs
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem("force_age_gate", "1");
                } catch {}
                navigate({ to: "/verify" });
              }}
              className="shrink-0 rounded-full bg-gradient-to-r from-primary to-fuchsia-500 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_6px_18px_-6px_rgba(217,70,239,0.7)] transition-transform active:scale-95"
            >
              {rejected ? "Reîncearcă" : "Verifică-te"}
            </button>
          )}
        </div>

        {pending && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/20">
                <Loader2 className="size-4 animate-spin text-amber-300" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-100">Verificare în curs</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                  Selfie-ul tău e procesat de Didit (procesator extern UE) pentru estimare
                  vârstă. De obicei durează câteva secunde, ocazional câteva minute.
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-amber-100/70">
                  Dacă nu ai apucat să finalizezi selfie-ul la Didit, sesiunea rămâne
                  neterminată. Poți relua verificarea:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        sessionStorage.setItem("force_age_gate", "1");
                      } catch {}
                      navigate({ to: "/verify" });
                    }}
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-400"
                  >
                    Reia verificarea
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      if (!confirm("Anulezi sesiunea de verificare curentă și o iei de la capăt?")) return;
                      const { error } = await supabase
                        .from("profiles")
                        .update({ age_status: "unverified" })
                        .eq("id", user.id);
                      if (error) {
                        toast.error(error.message);
                      } else {
                        toast.success("Sesiune anulată. Poți relua verificarea.");
                        setProfile((p) => (p ? { ...p, age_status: "unverified" } : p));
                      }
                    }}
                    className="rounded-full border border-amber-500/40 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/10"
                  >
                    Anulează sesiunea
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Support CTA — Suzeta e gratuit, o "susține" */}
        <Link
          to="/premium"
          className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-600 px-5 py-4 text-white shadow-[0_10px_30px_-8px_rgba(244,63,94,0.5)]"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="size-5" />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide">Totul e gratuit</p>
              <p className="text-xs opacity-90">Vezi ce include & cum ne susții</p>
            </div>
          </div>
          <ChevronRight className="size-4" />
        </Link>

        {/* Boost + Right Now tiles */}
        <div className="grid grid-cols-2 gap-3">
          <ActionTile
            to="/quests"
            icon={<Rocket className="size-6" />}
            label="Boost"
            hint={boostActive ? "Activ" : "Câștigă"}
            highlight={!!boostActive}
          />
          <ActionTile
            to="/settings"
            icon={<Ticket className="size-6" />}
            label="Right Now"
            hint={nowActive ? "Activ" : "Activează"}
            highlight={!!nowActive}
          />
        </div>

        {/* Presence */}
        <section className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/50 bg-surface/40">
          <ToggleRow
            label="Online"
            hint="Apari verde în Discover"
            checked={online}
            onChange={(v) => toggle("hide_online", !v)}
            saving={saving}
          />
          <ToggleRow
            label="Stealth"
            hint="Nu apari în Cine te-a vizitat / Global"
            checked={stealth}
            onChange={(v) => toggle("discrete_mode", v)}
            saving={saving}
            accent="pro"
          />
        </section>

        {/* Menu */}
        <section className="overflow-hidden rounded-2xl border border-border/50 bg-surface/40">
          <MenuRow to="/favorites" icon={<Album className="size-5" />} label="Albume & favorite" />
          <MenuRow to="/safety" icon={<ShieldCheck className="size-5" />} label="Siguranță" />
          <MenuRow to="/quests" icon={<Flame className="size-5" />} label="Quests & recompense" />
          
        </section>

        {/* Support — direct chat OR email */}
        <section className="rounded-2xl border border-border/50 bg-surface/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary">
              <HelpCircle className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Contact suport</p>
              <p className="text-[11px] text-muted-foreground">
                Răspundem în 24h lucrătoare. Alege canalul preferat.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://wa.me/40712345678?text=Salut%20Suzeta%2C%20am%20nevoie%20de%20ajutor%20cu%3A%20"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-surface"
            >
              <MessageCircle className="size-4 text-emerald-500" />
              Chat direct
            </a>
            <a
              href={`mailto:support@suzeta.eu?subject=${encodeURIComponent("Suport Suzeta")}&body=${encodeURIComponent(`\n\n---\nUser: ${user.email ?? ""}\nID: ${user.id}`)}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-surface"
            >
              <Mail className="size-4 text-rose-500" />
              Email
            </a>
          </div>
        </section>


        <p className="pb-4 text-center text-[11px] text-muted-foreground">Suzeta · {user.email}</p>
      </div>

      <BottomNav />
    </div>
  );
}

function ActionTile({
  to,
  icon,
  label,
  hint,
  highlight,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        "flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center transition-colors " +
        (highlight
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border/50 bg-surface/40 text-foreground hover:bg-surface")
      }
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </Link>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  saving,
  accent,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  saving?: boolean;
  accent?: "pro";
}) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {label}
          {accent === "pro" && (
            <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              Pro
            </span>
          )}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <span className="relative inline-block">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={saving}
          className="peer sr-only"
        />
        <span className="block h-7 w-12 rounded-full bg-muted transition-colors peer-checked:bg-emerald-500" />
        <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function MenuRow({
  to,
  href,
  icon,
  label,
}: {
  to?: string;
  href?: string;
  icon: React.ReactNode;
  label: string;
}) {
  const inner = (
    <>
      <span className="grid size-9 place-items-center rounded-full bg-muted/60 text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </>
  );
  const cls = "flex items-center gap-3 border-b border-border/40 px-4 py-3.5 last:border-0";
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={to!} className={cls}>
      {inner}
    </Link>
  );
}
