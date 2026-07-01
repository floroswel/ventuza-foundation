import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Crown, Eye, EyeOff, Pencil, Settings as SettingsIcon, ShieldAlert, Sparkles, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateBio, photoCoach } from "@/lib/ai.functions";
import { useConsent } from "@/lib/use-consent";
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
import { RightNowCard } from "@/components/RightNowCard";
import { PrivateAlbumManager } from "@/components/PrivateAlbum";
import { ProfileCompleteness } from "@/components/ProfileCompleteness";
import { ProfileStatsRow } from "@/components/ProfileStatsRow";
import { VoicePromptCard } from "@/components/VoicePromptCard";
import { MusicAnthemCard } from "@/components/MusicAnthemCard";
import { LifestyleFactsCard } from "@/components/LifestyleFactsCard";
import { ShareProfileCard } from "@/components/ShareProfileCard";
import { VideoClipCard } from "@/components/VideoClipCard";
import { DateVibesCard } from "@/components/DateVibesCard";
import { ProfileBadgesRow } from "@/components/ProfileBadgesRow";
import { BackButton } from "@/components/BackButton";
import { formatHeight } from "@/lib/discover";
import {
  GENDER_OPTIONS, PRONOUN_OPTIONS, ORIENTATION_OPTIONS,
  LOOKING_FOR_OPTIONS, INTEREST_OPTIONS,
  TRIBE_OPTIONS, BODY_TYPE_OPTIONS, POSITION_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS, ETHNICITY_OPTIONS,
  MEET_AT_OPTIONS, EXPECTATIONS_OPTIONS, SCENES_OPTIONS,
  SAFETY_OPTIONS, PREP_STATUS_OPTIONS, VACCINATION_OPTIONS,
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
  relationship_status: string | null;
  verified_at: string | null;
  incognito: boolean;
  verification_status: string;
  verification_selfie_path: string | null;
  travel_city: string | null;
  travel_until: string | null;
  boost_until: string | null;
  looking_now_until: string | null;
  looking_now_intent: string | null;
  meet_at: string[] | null;
  expectations: string[] | null;
  scenes: string[] | null;
  safety_practices: string[] | null;
  prep_status: string | null;
  vaccinations: string[] | null;
  accept_nsfw_photos: boolean | null;
  voice_prompt_path: string | null;
  voice_prompt_question: string | null;
  voice_prompt_duration_sec: number | null;
  anthem: { title: string; artist: string; url?: string } | null;
  zodiac: string | null;
  languages: string[] | null;
  education: string | null;
  school: string | null;
  job_title: string | null;
  company: string | null;
  religion: string | null;
  politics: string | null;
  children: string | null;
  pets: string[] | null;
  drinking: string | null;
  smoking: string | null;
  cannabis: string | null;
  drugs: string | null;
  workout: string | null;
  diet: string | null;
  sleep_schedule: string | null;
  profile_slug: string | null;
  video_clip_path: string | null;
  ask_me_about: string[] | null;
  dealbreakers: string[] | null;
  ideal_match: string | null;
  created_at: string | null;
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
  const { user, loading: authLoading } = useAuth();
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
      let p: Profile | null = null;
      if (data) {
        p = data as unknown as Profile;
      }
      setProfile(p);
      setLoading(false);
      if (p && !p.onboarding_completed) navigate({ to: "/n" });
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
        <div className="absolute left-4 top-4">
          <BackButton fallback="/discover" />
        </div>

        <div className="absolute right-4 top-4 flex gap-2">
          <NotificationBell className="size-10 border border-border bg-surface/80 backdrop-blur" />
          <Button size="icon" variant="subtle" onClick={() => navigate({ to: "/premium" })} aria-label="Premium">
            <Crown className="size-4 text-primary" />
          </Button>
          <Button size="icon" variant="subtle" onClick={() => setEditing(true)} aria-label="Edit profile">
            <Pencil className="size-4" />
          </Button>
          <Button size="icon" variant="subtle" onClick={() => navigate({ to: "/settings" })} aria-label="Settings">
            <SettingsIcon className="size-4" />
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
          <div className="mt-3">
            <ProfileBadgesRow profile={profile} />
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

        <ProfileCompleteness profile={profile} onEdit={() => setEditing(true)} />

        <ProfileStatsRow userId={profile.id} />

        <ShareProfileCard slug={profile.profile_slug} displayName={profile.display_name} />

        <VoicePromptCard
          userId={profile.id}
          voicePath={profile.voice_prompt_path}
          question={profile.voice_prompt_question}
          durationSec={profile.voice_prompt_duration_sec}
          onChange={(next) => setProfile({ ...profile, ...next })}
        />

        <MusicAnthemCard
          userId={profile.id}
          anthem={profile.anthem}
          onChange={(next) => setProfile({ ...profile, anthem: next })}
        />

        <VideoClipCard
          userId={profile.id}
          videoPath={profile.video_clip_path}
          onChange={(p) => setProfile({ ...profile, video_clip_path: p })}
        />

        <DateVibesCard
          userId={profile.id}
          vibes={{ ask_me_about: profile.ask_me_about, dealbreakers: profile.dealbreakers, ideal_match: profile.ideal_match }}
          onChange={(next) => setProfile({ ...profile, ...next })}
        />

        <LifestyleFactsCard
          userId={profile.id}
          facts={{
            zodiac: profile.zodiac, languages: profile.languages, education: profile.education,
            school: profile.school, job_title: profile.job_title, company: profile.company,
            religion: profile.religion, politics: profile.politics, children: profile.children,
            pets: profile.pets, drinking: profile.drinking, smoking: profile.smoking,
            cannabis: profile.cannabis, drugs: profile.drugs, workout: profile.workout,
            diet: profile.diet, sleep_schedule: profile.sleep_schedule,
          }}
          onChange={(next) => setProfile({ ...profile, ...next })}
        />







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

        {(profile.body_type || profile.position || profile.height_cm || profile.weight_kg || profile.ethnicity || profile.relationship_status || profile.prep_status) && (
          <Section title="Stats">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
              {profile.body_type && <StatRow label="Body" value={profile.body_type} />}
              {profile.position && <StatRow label="Position" value={profile.position} />}
              {formatHeight(profile.height_cm) && <StatRow label="Height" value={formatHeight(profile.height_cm)!} />}
              {profile.weight_kg && <StatRow label="Weight" value={`${profile.weight_kg} kg`} />}
              {profile.ethnicity && <StatRow label="Ethnicity" value={profile.ethnicity} />}
              {profile.relationship_status && <StatRow label="Relationship" value={profile.relationship_status} />}
              {profile.prep_status && <StatRow label="PrEP" value={profile.prep_status} />}
            </div>
          </Section>
        )}

        {profile.expectations && profile.expectations.length > 0 && (
          <Section title="Expectations">
            <div className="flex flex-wrap gap-2">{profile.expectations.map((v) => <Chip key={v} active>{v}</Chip>)}</div>
          </Section>
        )}

        {profile.meet_at && profile.meet_at.length > 0 && (
          <Section title="Meet at">
            <div className="flex flex-wrap gap-2">{profile.meet_at.map((v) => <Chip key={v} active>{v}</Chip>)}</div>
          </Section>
        )}

        {profile.scenes && profile.scenes.length > 0 && (
          <Section title="Scenes">
            <div className="flex flex-wrap gap-2">{profile.scenes.map((v) => <Chip key={v} active>{v}</Chip>)}</div>
          </Section>
        )}

        {((profile.safety_practices && profile.safety_practices.length > 0) || (profile.vaccinations && profile.vaccinations.length > 0)) && (
          <Section title="Safer play">
            {profile.safety_practices && profile.safety_practices.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">{profile.safety_practices.map((v) => <Chip key={v} active>{v}</Chip>)}</div>
            )}
            {profile.vaccinations && profile.vaccinations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.vaccinations.map((v) => (
                  <span key={v} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">💉 {v}</span>
                ))}
              </div>
            )}
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
          <RightNowCard
            userId={profile.id}
            lookingNowUntil={profile.looking_now_until}
            lookingNowIntent={profile.looking_now_intent}
            onUpdate={async () => {
              const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).maybeSingle();
              if (data) setProfile(data as unknown as Profile);
            }}
          />
          <ProfilePremiumPanel
            userId={profile.id}
            mainPhotoPath={profile.photos?.[0] ?? null}
            verificationStatus={profile.verification_status}
            travelCity={profile.travel_city}
            travelUntil={profile.travel_until}
            boostUntil={profile.boost_until}
            onUpdate={async () => {
              const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).maybeSingle();
              if (data) setProfile(data as unknown as Profile);
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
    const f = form as unknown as Profile & { hide_age?: boolean };
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
      // Datele HIV au fost eliminate din schemă (decizie GDPR).
      relationship_status: form.relationship_status,
      meet_at: form.meet_at ?? [],
      expectations: form.expectations ?? [],
      scenes: form.scenes ?? [],
      safety_practices: form.safety_practices ?? [],
      vaccinations: form.vaccinations ?? [],
      prep_status: form.prep_status,
      accept_nsfw_photos: form.accept_nsfw_photos ?? false,
      hide_age: f.hide_age ?? false,
    }).eq("id", profile.id).select("*").maybeSingle();
    if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    setSaving(false);
    onSaved(data as unknown as Profile);
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
        <h2 className="font-display text-lg">Edit Profile</h2>
        <Button onClick={save} variant="hero" size="sm" disabled={saving}>
          {saving && <Loader2 className="size-3 animate-spin" />} Save
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">
        {/* About */}
        <EditSection>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              value={form.display_name ?? ""}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="Everyone will see this on the grid…"
              maxLength={15}
              className="h-12 bg-surface border-border"
            />
            <p className="text-right text-[10px] text-muted-foreground">{(form.display_name ?? "").length}/15</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>About Me</Label>
              <AiBioButton form={form} setForm={setForm} />
            </div>
            <Textarea
              value={form.bio ?? ""}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
              maxLength={255}
              placeholder="Tell people who you are and what you're looking for (not what you're not looking for)"
              className="bg-surface border-border"
            />
            <p className="text-right text-[10px] text-muted-foreground">{(form.bio ?? "").length}/255</p>
          </div>
          <EditChips label="My Tags" options={INTEREST_OPTIONS} value={form.interests ?? []} onChange={(v) => setForm({ ...form, interests: v })} />
        </EditSection>

        {/* Stats */}
        <SectionDivider label="Stats" />
        <EditSection>
          <ToggleRow
            label="Show Age"
            checked={!(form as unknown as { hide_age?: boolean }).hide_age}
            onChange={(on) => setForm({ ...form, ...({ hide_age: !on } as Partial<Profile>) } as Profile)}
            help="When on, this appears on your profile and allows other users to filter for you."
          />
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
          {single("ethnicity", ETHNICITY_OPTIONS)}
          {single("body_type", BODY_TYPE_OPTIONS)}
          {single("position", POSITION_OPTIONS)}
          {single("relationship_status", RELATIONSHIP_STATUS_OPTIONS)}
        </EditSection>

        {/* Preferences */}
        <SectionDivider label="Preferences" />
        <EditSection>
          <EditChips label="My Tribes" options={TRIBE_OPTIONS} value={form.tribes ?? []} onChange={(v) => setForm({ ...form, tribes: v })} />
          <EditChips label="Looking For" options={LOOKING_FOR_OPTIONS} value={form.looking_for ?? []} onChange={(v) => setForm({ ...form, looking_for: v })} />
          <EditChips label="Meet At" options={MEET_AT_OPTIONS} value={form.meet_at ?? []} onChange={(v) => setForm({ ...form, meet_at: v })} />
          <EditChips label="Expectations" options={EXPECTATIONS_OPTIONS} value={form.expectations ?? []} onChange={(v) => setForm({ ...form, expectations: v })} />
          <EditChips label="Scenes" options={SCENES_OPTIONS} value={form.scenes ?? []} onChange={(v) => setForm({ ...form, scenes: v })} />

          <label className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
            <div>
              <p className="text-sm font-medium">Accept NSFW Pics</p>
              <p className="text-xs text-muted-foreground">Allow matches to send adult content in DMs.</p>
            </div>
            <input
              type="checkbox"
              checked={!!form.accept_nsfw_photos}
              onChange={(e) => setForm({ ...form, accept_nsfw_photos: e.target.checked })}
              className="size-5 accent-primary"
            />
          </label>
        </EditSection>

        {/* Identity */}
        <SectionDivider label="Identity" />
        <EditSection>
          <EditChips label="Gender" options={GENDER_OPTIONS} value={form.gender ?? []} onChange={(v) => setForm({ ...form, gender: v })} />
          <EditChips label="Pronouns" options={PRONOUN_OPTIONS} value={form.pronouns ?? []} onChange={(v) => setForm({ ...form, pronouns: v })} />
          <EditChips label="Orientation" options={ORIENTATION_OPTIONS} value={form.orientation ?? []} onChange={(v) => setForm({ ...form, orientation: v })} />
        </EditSection>

        {/* Health */}
        <SectionDivider label="Health" />
        <EditSection>
          {single("prep_status", PREP_STATUS_OPTIONS)}
          <EditChips label="Health Practices" options={SAFETY_OPTIONS} value={form.safety_practices ?? []} onChange={(v) => setForm({ ...form, safety_practices: v })} />
          <EditChips label="Vaccinations" options={VACCINATION_OPTIONS} value={form.vaccinations ?? []} onChange={(v) => setForm({ ...form, vaccinations: v })} />
          <p className="rounded-xl border border-border/50 bg-surface/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground/80">Resurse de sănătate.</strong> Ventuza nu stochează date despre HIV. Pentru testare gratuită și consiliere vezi <a href="https://www.arasnet.ro" target="_blank" rel="noreferrer" className="underline">ARAS</a> sau centrul de siguranță (<a href="/safety" className="underline">/safety</a>).
          </p>
        </EditSection>
      </div>
    </div>
  );
}

function EditSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6 bg-surface/40 px-6 py-6">{children}</div>;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="border-y border-border bg-background px-6 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div>
      <label className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-primary" />
      </label>
      {help && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{help}</p>}
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
  const aiConsent = useConsent("ai_features");
  const [loading, setLoading] = useState(false);
  async function run() {
    // Opt-in obligatoriu pentru funcții AI — vezi AGENTS.md "REGULĂ — CONSIMȚĂMINTE".
    const ok = await aiConsent.ensure();
    if (!ok) return;
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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-60"
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
        AI bio
      </button>
      <span className="text-[10px] text-muted-foreground">
        Textul e procesat de un serviciu AI extern (Lovable AI Gateway).
      </span>
    </div>
  );
}

function PhotoCoachButton({ photos }: { photos: string[] }) {
  const coach = useServerFn(photoCoach);
  const aiConsent = useConsent("ai_features");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  async function run() {
    if (!photos.length) {
      toast.message("Adaugă cel puțin o poză.");
      return;
    }
    // Opt-in obligatoriu pentru funcții AI — vezi AGENTS.md "REGULĂ — CONSIMȚĂMINTE".
    const ok = await aiConsent.ensure();
    if (!ok) return;
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
      <p className="mt-1 text-[10px] text-muted-foreground">
        Pozele sunt analizate de un serviciu AI extern (Lovable AI Gateway).
      </p>
      {feedback && (
        <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {feedback}
        </div>
      )}
    </div>
  );
}

