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
  Rocket,
  Ticket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cont — Ventuza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

type ProfileSummary = {
  display_name: string | null;
  photo_url: string | null;
  age_status: string | null;
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
      .select("display_name, photo_url, age_status, hide_online, discrete_mode, boost_until, looking_now_until")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as ProfileSummary | null));
  }, [user]);

  async function toggle(field: "hide_online" | "discrete_mode", value: boolean) {
    if (!user || !profile) return;
    setSaving(true);
    setProfile({ ...profile, [field]: value });
    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      setProfile((p) => (p ? { ...p, [field]: !value } : p));
    }
  }

  if (authLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const verified = profile?.age_status === "verified";
  const online = !profile?.hide_online;
  const stealth = !!profile?.discrete_mode;
  const boostActive = profile?.boost_until && new Date(profile.boost_until).getTime() > Date.now();
  const nowActive = profile?.looking_now_until && new Date(profile.looking_now_until).getTime() > Date.now();

  return (
    <div className="min-h-screen bg-background pb-28">
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
        <Link
          to="/profile"
          className="flex items-center gap-4 rounded-2xl border border-border/50 bg-surface/40 p-3"
        >
          <div className="size-16 shrink-0 overflow-hidden rounded-full bg-muted">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl">
                {(profile?.display_name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
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
            ) : (
              <Link
                to="/settings"
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-semibold text-foreground"
              >
                Verifică-te
              </Link>
            )}
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>

        {/* Support CTA — Ventuza e gratuit, o "susține" */}
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
          <MenuRow
            to="/favorites"
            icon={<Album className="size-5" />}
            label="Albume & favorite"
          />
          <MenuRow
            to="/safety"
            icon={<ShieldCheck className="size-5" />}
            label="Siguranță"
          />
          <MenuRow
            to="/quests"
            icon={<Flame className="size-5" />}
            label="Quests & recompense"
          />
          <MenuRow
            href="mailto:support@ventuza.eu"
            icon={<HelpCircle className="size-5" />}
            label="Contact suport"
          />
        </section>

        <p className="pb-4 text-center text-[11px] text-muted-foreground">
          Ventuza · {user.email}
        </p>
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
