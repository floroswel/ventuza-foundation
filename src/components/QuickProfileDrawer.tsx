import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Flame, Ghost, ImageIcon, LogOut, Pencil, Settings as SettingsIcon, Shield, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { setLookingNow } from "@/lib/social";
import { cn } from "@/lib/utils";

type Me = {
  display_name: string | null;
  photos: string[] | null;
  hide_online: boolean | null;
  looking_now_until: string | null;
};

export function QuickProfileDrawer() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [signedAvatar, setSignedAvatar] = useState<string | null>(null);
  const [savingHide, setSavingHide] = useState(false);
  const [busyNow, setBusyNow] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, photos, hide_online, looking_now_until")
        .eq("id", user.id)
        .maybeSingle();
      if (cancel || !data) return;
      const d = data as Me;
      setMe(d);
      const first = d.photos?.[0];
      if (first) {
        const { data: s } = await supabase.storage.from("profile-photos").createSignedUrl(first, 3600);
        if (!cancel) setSignedAvatar(s?.signedUrl ?? null);
      }
    })();
    return () => { cancel = true; };
  }, [user, open]);

  async function toggleIncognito(next: boolean) {
    if (!user || !me) return;
    setSavingHide(true);
    setMe({ ...me, hide_online: next });
    const { error } = await supabase.from("profiles").update({ hide_online: next }).eq("id", user.id);
    setSavingHide(false);
    if (error) {
      toast.error(error.message);
      setMe({ ...me, hide_online: !next });
    } else {
      toast.success(next ? "Incognito activat" : "Online vizibil");
    }
  }

  async function activate(hours: number) {
    setBusyNow(true);
    try {
      await setLookingNow(hours);
      if (hours > 0) {
        const until = new Date(Date.now() + hours * 3600_000).toISOString();
        setMe((m) => (m ? { ...m, looking_now_until: until } : m));
        toast.success(`Right Now activ pentru ${hours}h`);
      } else {
        setMe((m) => (m ? { ...m, looking_now_until: null } : m));
        toast.success("Dezactivat");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyNow(false);
    }
  }

  const incognito = !!me?.hide_online;
  const rightNowActive = !!(me?.looking_now_until && new Date(me.looking_now_until) > new Date());

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Quick profile"
          className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface"
        >
          {signedAvatar ? (
            <img src={signedAvatar} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">
              {(me?.display_name?.[0] ?? "?").toUpperCase()}
            </span>
          )}
          <span
            className={cn(
              "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background",
              incognito ? "bg-zinc-500" : "bg-emerald-500"
            )}
          />
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[88vw] max-w-[360px] overflow-y-auto bg-background p-0">
        <div className="flex flex-col gap-5 p-5 pb-10">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="size-28 overflow-hidden rounded-2xl border border-border bg-surface">
              {signedAvatar ? (
                <img src={signedAvatar} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-muted-foreground">
                  <ImageIcon className="size-8" />
                </div>
              )}
            </div>
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-elevated"
            >
              {me?.display_name ?? "Set a Display Name"}
            </Link>
          </div>

          {/* Online / Incognito segmented */}
          <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-surface p-1">
            <button
              disabled={savingHide}
              onClick={() => toggleIncognito(false)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition",
                !incognito ? "bg-emerald-500/15 text-emerald-300" : "text-muted-foreground"
              )}
            >
              <span className="size-2 rounded-full bg-emerald-500" /> Online
            </button>
            <button
              disabled={savingHide}
              onClick={() => toggleIncognito(true)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition",
                incognito ? "bg-zinc-700 text-foreground" : "text-muted-foreground"
              )}
            >
              <Ghost className="size-4" /> Incognito
            </button>
          </div>

          {/* Add-ons */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Add-ons</p>
            <div className="space-y-2">
              <Link
                to="/premium"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Zap className="size-4 text-emerald-400" /> Boost
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  New
                </span>
              </Link>

              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <Flame className="size-4 text-rose-400" /> Right Now
                  </span>
                  {rightNowActive ? (
                    <button
                      disabled={busyNow}
                      onClick={() => activate(0)}
                      className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200"
                    >
                      Stop
                    </button>
                  ) : (
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
                      Free
                    </span>
                  )}
                </div>
                {rightNowActive && me?.looking_now_until ? (
                  <p className="mt-1 text-[11px] text-rose-200">
                    Activ până la{" "}
                    {new Date(me.looking_now_until).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {[1, 2, 4, 8].map((h) => (
                      <button
                        key={h}
                        disabled={busyNow}
                        onClick={() => activate(h)}
                        className="rounded-full bg-rose-500/15 py-1.5 text-[11px] font-medium text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Plan */}
          <Link
            to="/premium"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent px-4 py-4 ring-1 ring-primary/30"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Choose a plan</p>
              <p className="mt-1 text-base font-semibold">Ventuza Premium</p>
              <p className="text-[11px] text-muted-foreground">Vezi mai mulți, fii văzut primul</p>
            </div>
            <Sparkles className="size-5 text-primary" />
          </Link>

          {/* Menu */}
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            <MenuLink to="/profile" icon={<Pencil className="size-4" />} label="Edit Profile" onClick={() => setOpen(false)} />
            <MenuLink to="/profile" icon={<ImageIcon className="size-4" />} label="My Albums" onClick={() => setOpen(false)} />
            <MenuLink to="/safety" icon={<Shield className="size-4" />} label="Safety & Privacy Center" onClick={() => setOpen(false)} />
            <MenuLink to="/settings" icon={<SettingsIcon className="size-4" />} label="Settings" onClick={() => setOpen(false)} />
          </div>

          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
              navigate({ to: "/" });
            }}
            className="flex items-center justify-center gap-2 rounded-full border border-border bg-surface py-3 text-sm font-medium hover:bg-surface-elevated"
          >
            <LogOut className="size-4" /> Deconectare
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MenuLink({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </Link>
  );
}
