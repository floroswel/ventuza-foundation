import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Eye, EyeOff, LogOut, Pencil, ShieldAlert, Sparkles, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateBio, photoCoach } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/Chip";
import { BottomNav } from "@/components/BottomNav";
import { PhotoManager } from "@/components/PhotoManager";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfilePremiumPanel } from "@/components/ProfilePremiumPanel";
import { PrivateAlbumManager } from "@/components/PrivateAlbum";
import { formatHeight } from "@/lib/discover";
import {
  GENDER_OPTIONS, PRONOUN_OPTIONS, ORIENTATION_OPTIONS,
  LOOKING_FOR_OPTIONS, INTEREST_OPTIONS,
  TRIBE_OPTIONS, BODY_TYPE_OPTIONS, POSITION_OPTIONS,
  HIV_STATUS_OPTIONS, RELATIONSHIP_STATUS_OPTIONS, ETHNICITY_OPTIONS,
} from "@/lib/profile-options";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Your profile — Ventuza" }] }),
  component: ProfilePage,
});

type Profile = {
  id: string;
  display_name: string | null;
  birthdate: string | null;
  gender: string[] | null;
  gender_custom: string | null;
  pronouns: string[] | null;
  pronouns_custom: string | null;
  orientation: string[] | null;
  looking_for: string[] | null;
  interests: string[] | null;
  bio: string | null;
  prompts: Array<{ question: string; answer: string }> | null;
  photos: string[] | null;
  onboarding_completed: boolean;
  verified: boolean;
  tribes: string[] | null;
  body_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  ethnicity: string | null;
  position: string | null;
  hiv_status: string | null;
  hiv_test_date: string | null;
  relationship_status: string | null;
  verified_at: string | null;
  incognito: boolean;
  verification_status: string;
  verification_selfie_path: string | null;
  travel_city: string | null;
  travel_until: string | null;
  boost_until: string | null;
};

function age(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) toast.error(error.message);
      const p = data as Profile | null;
      setProfile(p);
      setLoading(false);
      if (p && !p.onboarding_completed) navigate({ to: "/onboarding" });
      if (p?.photos?.length) {
        const out: Record<string, string> = {};
        for (const path of p.photos) {
          const { data: s } = await supabase.storage.from("profile-photos").createSignedUrl(path, 3600);
          if (s?.signedUrl) out[path] = s.signedUrl;
        }
        setSigned(out);
      }
    })();
  }, [user, navigate]);

  if (loading || !profile) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const primary = profile.photos?.[0];

  return (
    <main className="min-h-dvh bg-background pb-28">
      {/* hero photo */}
      <section className="relative">
        <div className="aspect-[4/5] w-full overflow-hidden bg-surface">
          {primary && signed[primary] ? (
            <img src={signed[primary]} alt={profile.display_name ?? ""} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">No photo</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="absolute right-4 top-4 flex gap-2">
          <NotificationBell className="size-10 border border-border bg-surface/80 backdrop-blur" />
          <Button size="icon" variant="subtle" onClick={() => setEditing(true)} aria-label="Edit profile">
            <Pencil className="size-4" />
          </Button>
          <Button size="icon" variant="subtle" onClick={async () => { await signOut(); navigate({ to: "/" }); }} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
          <div className="flex items-end gap-3">
            <h1 className="wordmark text-4xl font-medium leading-tight">
              {profile.display_name}
              {age(profile.birthdate) && <span className="ml-2 text-foreground/80">{age(profile.birthdate)}</span>}
            </h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {profile.verified_at ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary backdrop-blur">
                <BadgeCheck className="size-3" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/70 px-2.5 py-1 text-xs backdrop-blur">
                <ShieldAlert className="size-3" /> Unverified
              </span>
            )}
            {profile.incognito && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/70 px-2.5 py-1 text-xs backdrop-blur">
                <EyeOff className="size-3" /> Incognito
              </span>
            )}
            {profile.pronouns?.slice(0, 2).map((p) => (
              <span key={p} className="rounded-full bg-surface/70 px-2.5 py-1 text-xs backdrop-blur">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-8 px-6 pt-8">
        {/* photos grid */}
        <section>
          <PhotoManager
            userId={profile.id}
            photos={profile.photos ?? []}
            onChange={(next) => setProfile({ ...profile, photos: next })}
          />
          <PhotoCoachButton photos={profile.photos ?? []} />
        </section>




        {profile.bio && (
          <Section title="About">
            <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{profile.bio}</p>
          </Section>
        )}

        {profile.prompts && profile.prompts.length > 0 && (
          <Section title="In their words">
            <div className="space-y-3">
              {profile.prompts.map((p, i) => p.question && (
                <div key={i} className="rounded-2xl border border-border bg-surface p-5">
                  <p className="text-xs uppercase tracking-wider text-primary">{p.question}</p>
                  <p className="mt-2 font-display text-xl leading-snug">{p.answer}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {profile.interests && profile.interests.length > 0 && (
          <Section title="Interests">
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((i) => <Chip key={i} active>{i}</Chip>)}
            </div>
          </Section>
        )}

        {profile.tribes && profile.tribes.length > 0 && (
          <Section title="Tribes">
            <div className="flex flex-wrap gap-2">
              {profile.tribes.map((t) => <Chip key={t} active>{t}</Chip>)}
            </div>
          </Section>
        )}

        {(profile.body_type || profile.position || profile.height_cm || profile.weight_kg || profile.ethnicity || profile.relationship_status || profile.hiv_status) && (
          <Section title="Stats">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
              {profile.body_type && <StatRow label="Body" value={profile.body_type} />}
              {profile.position && <StatRow label="Position" value={profile.position} />}
              {formatHeight(profile.height_cm) && <StatRow label="Height" value={formatHeight(profile.height_cm)!} />}
              {profile.weight_kg && <StatRow label="Weight" value={`${profile.weight_kg} kg`} />}
              {profile.ethnicity && <StatRow label="Ethnicity" value={profile.ethnicity} />}
              {profile.relationship_status && <StatRow label="Relationship" value={profile.relationship_status} />}
              {profile.hiv_status && <StatRow label="HIV" value={profile.hiv_status} />}
            </div>
          </Section>
        )}

        <Section title="Identity">
          <TagRow label="Gender" values={[...(profile.gender ?? []), ...(profile.gender_custom ? [profile.gender_custom] : [])]} />
          <TagRow label="Pronouns" values={[...(profile.pronouns ?? []), ...(profile.pronouns_custom ? [profile.pronouns_custom] : [])]} />
          <TagRow label="Orientation" values={profile.orientation ?? []} />
          <TagRow label="Looking for" values={profile.looking_for ?? []} />
        </Section>

        <Section title="Activity">
          <Link
            to="/visitors"
            className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 hover:border-primary/50"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Eye className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Who viewed you</p>
                <p className="text-xs text-muted-foreground">See everyone who checked your profile</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">›</span>
          </Link>
        </Section>

        <Section title="Verificare & Premium">
          <ProfilePremiumPanel
            userId={profile.id}
            mainPhotoPath={profile.photos?.[0] ?? null}
            verificationStatus={profile.verification_status}
            travelCity={profile.travel_city}
            travelUntil={profile.travel_until}
            boostUntil={profile.boost_until}
            onUpdate={async () => {
              const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).maybeSingle();
              if (data) setProfile(data as Profile);
            }}
          />
        </Section>

        <Section title="Album privat">
          <PrivateAlbumManager userId={profile.id} />
        </Section>




        {/* Privacy quick actions */}
        <Section title="Privacy">
          <button
            onClick={async () => {
              const next = !profile.incognito;
              const { error } = await supabase.from("profiles").update({ incognito: next }).eq("id", profile.id);
              if (error) return toast.error(error.message);
              setProfile({ ...profile, incognito: next });
              toast.success(next ? "You're now in Obsidian Vault." : "You're visible again.");
            }}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left hover:border-primary/50"
          >
            <div>
              <p className="text-sm font-medium">Obsidian Vault</p>
              <p className="text-xs text-muted-foreground">Hide your profile from the grid. You can still browse.</p>
            </div>
            <span className={profile.incognito ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" : "rounded-full bg-surface-elevated px-3 py-1 text-xs text-muted-foreground"}>
              {profile.incognito ? "On" : "Off"}
            </span>
          </button>
        </Section>
      </div>

      {editing && (
        <EditDrawer
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(p) => { setProfile(p); setEditing(false); toast.success("Profile updated."); }}
        />
      )}
      <BottomNav />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function TagRow({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">{v}</span>
        ))}
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-foreground/90">{value}</p>
    </div>
  );
}

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function EditDrawer({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data, error } = await supabase.from("profiles").update({
      display_name: form.display_name,
      bio: form.bio,
      gender: form.gender ?? [],
      gender_custom: form.gender_custom,
      pronouns: form.pronouns ?? [],
      pronouns_custom: form.pronouns_custom,
      orientation: form.orientation ?? [],
      looking_for: form.looking_for ?? [],
      interests: form.interests ?? [],
      prompts: form.prompts ?? [],
      tribes: form.tribes ?? [],
      body_type: form.body_type,
      height_cm: form.height_cm,
      weight_kg: form.weight_kg,
      ethnicity: form.ethnicity,
      position: form.position,
      hiv_status: form.hiv_status,
      relationship_status: form.relationship_status,
    }).eq("id", profile.id).select("*").maybeSingle();
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    onSaved(data as Profile);
  }

  function single<K extends keyof Profile>(k: K, options: string[]) {
    const current = (form[k] as unknown as string) || "";
    return (
      <div className="space-y-2">
        <Label>{String(k).replace(/_/g, " ").replace(/^./, c => c.toUpperCase())}</Label>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Chip key={o} active={current === o} onClick={() => setForm({ ...form, [k]: current === o ? null : o } as Profile)}>{o}</Chip>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="size-5" />
        </button>
        <h2 className="font-display text-lg">Edit profile</h2>
        <Button onClick={save} variant="hero" size="sm" disabled={saving}>
          {saving && <Loader2 className="size-3 animate-spin" />} Save
        </Button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <div className="space-y-2">
          <Label>Display name</Label>
          <Input value={form.display_name ?? ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-12 bg-surface border-border" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Bio</Label>
            <AiBioButton form={form} setForm={setForm} />
          </div>
          <Textarea value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={5} maxLength={500} className="bg-surface border-border" />
        </div>
        <EditChips label="Tribes" options={TRIBE_OPTIONS} value={form.tribes ?? []} onChange={(v) => setForm({ ...form, tribes: v })} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Height (cm)</Label>
            <Input type="number" min={140} max={220} value={form.height_cm ?? ""} onChange={(e) => setForm({ ...form, height_cm: e.target.value ? Number(e.target.value) : null })} className="h-12 bg-surface border-border" />
          </div>
          <div className="space-y-2">
            <Label>Weight (kg)</Label>
            <Input type="number" min={40} max={200} value={form.weight_kg ?? ""} onChange={(e) => setForm({ ...form, weight_kg: e.target.value ? Number(e.target.value) : null })} className="h-12 bg-surface border-border" />
          </div>
        </div>

        {single("body_type", BODY_TYPE_OPTIONS)}
        {single("position", POSITION_OPTIONS)}
        {single("ethnicity", ETHNICITY_OPTIONS)}
        {single("relationship_status", RELATIONSHIP_STATUS_OPTIONS)}
        {single("hiv_status", HIV_STATUS_OPTIONS)}

        <EditChips label="Gender" options={GENDER_OPTIONS} value={form.gender ?? []} onChange={(v) => setForm({ ...form, gender: v })} />
        <EditChips label="Pronouns" options={PRONOUN_OPTIONS} value={form.pronouns ?? []} onChange={(v) => setForm({ ...form, pronouns: v })} />
        <EditChips label="Orientation" options={ORIENTATION_OPTIONS} value={form.orientation ?? []} onChange={(v) => setForm({ ...form, orientation: v })} />
        <EditChips label="Looking for" options={LOOKING_FOR_OPTIONS} value={form.looking_for ?? []} onChange={(v) => setForm({ ...form, looking_for: v })} />
        <EditChips label="Interests" options={INTEREST_OPTIONS} value={form.interests ?? []} onChange={(v) => setForm({ ...form, interests: v })} />
      </div>
    </div>
  );
}

function EditChips({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={value.includes(o)} onClick={() => onChange(toggle(value, o))}>{o}</Chip>
        ))}
      </div>
    </div>
  );
}

function AiBioButton({ form, setForm }: { form: Profile; setForm: (p: Profile) => void }) {
  const gen = useServerFn(generateBio);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const a = form.birthdate ? age(form.birthdate) ?? undefined : undefined;
      const res = await gen({
        data: {
          name: form.display_name ?? undefined,
          age: a,
          interests: form.interests ?? [],
          tribes: form.tribes ?? [],
          lookingFor: form.looking_for ?? [],
          vibe: "witty",
        },
      });
      if (res?.bio) {
        setForm({ ...form, bio: res.bio });
        toast.success("Bio generat ✨");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI eșuat");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
      AI bio
    </button>
  );
}

function PhotoCoachButton({ photos }: { photos: string[] }) {
  const coach = useServerFn(photoCoach);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  async function run() {
    if (!photos.length) {
      toast.message("Adaugă cel puțin o poză.");
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const signed = await Promise.all(
        photos.slice(0, 6).map(async (p) => {
          const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p, 600);
          return data?.signedUrl ?? null;
        }),
      );
      const urls = signed.filter(Boolean) as string[];
      if (!urls.length) throw new Error("Nu am putut accesa pozele.");
      const res = await coach({ data: { photoUrls: urls } });
      setFeedback(res.feedback);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI eșuat");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-60"
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
        AI photo coach
      </button>
      {feedback && (
        <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {feedback}
        </div>
      )}
    </div>
  );
}

