import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/Chip";
import {
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  ORIENTATION_OPTIONS,
  LOOKING_FOR_OPTIONS,
  INTEREST_OPTIONS,
  PROMPT_OPTIONS,
  TRIBE_OPTIONS,
  BODY_TYPE_OPTIONS,
  POSITION_OPTIONS,
  HIV_STATUS_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
  ETHNICITY_OPTIONS,
} from "@/lib/profile-options";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Build your profile — Ventuza" }] }),
  component: Onboarding,
});

type Prompt = { question: string; answer: string };

type Data = {
  display_name: string;
  birthdate: string;
  gender: string[];
  gender_custom: string;
  pronouns: string[];
  pronouns_custom: string;
  orientation: string[];
  looking_for: string[];
  tribes: string[];
  body_type: string;
  height_cm: number | null;
  weight_kg: number | null;
  ethnicity: string;
  position: string;
  hiv_status: string;
  relationship_status: string;
  interests: string[];
  prompts: Prompt[];
  bio: string;
  photos: string[];
};

const empty: Data = {
  display_name: "",
  birthdate: "",
  gender: [],
  gender_custom: "",
  pronouns: [],
  pronouns_custom: "",
  orientation: [],
  looking_for: [],
  tribes: [],
  body_type: "",
  height_cm: null,
  weight_kg: null,
  ethnicity: "",
  position: "",
  hiv_status: "",
  relationship_status: "",
  interests: [],
  prompts: [],
  bio: "",
  photos: [],
};

const STEPS = [
  "name",
  "birthdate",
  "gender",
  "pronouns",
  "orientation",
  "looking_for",
  "tribes",
  "stats",
  "health",
  "interests",
  "prompts",
  "bio",
  "photos",
] as const;

function calcAge(iso: string) {
  if (!iso) return 0;
  const d = new Date(iso);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  const canContinue = useMemo(() => {
    switch (current) {
      case "name": return data.display_name.trim().length >= 2;
      case "birthdate": return data.birthdate && calcAge(data.birthdate) >= 18;
      case "gender": return data.gender.length > 0 || data.gender_custom.trim().length > 0;
      case "pronouns": return data.pronouns.length > 0 || data.pronouns_custom.trim().length > 0;
      case "orientation": return data.orientation.length > 0;
      case "looking_for": return data.looking_for.length > 0;
      case "interests": return data.interests.length >= 3;
      case "prompts": return data.prompts.length === 3 && data.prompts.every((p) => p.answer.trim().length > 0);
      case "bio": return data.bio.trim().length >= 20;
      case "photos": return data.photos.length >= 1;
    }
  }, [current, data]);

  async function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo(0, 0);
      return;
    }
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: data.display_name.trim(),
      birthdate: data.birthdate,
      gender: data.gender,
      gender_custom: data.gender_custom.trim() || null,
      pronouns: data.pronouns,
      pronouns_custom: data.pronouns_custom.trim() || null,
      orientation: data.orientation,
      looking_for: data.looking_for,
      interests: data.interests,
      bio: data.bio.trim(),
      prompts: data.prompts,
      photos: data.photos,
      onboarding_completed: true,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Your profile is ready.");
    navigate({ to: "/profile" });
  }

  function back() {
    if (step === 0) navigate({ to: "/" });
    else setStep(step - 1);
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <button onClick={back} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-4" /> Back
          </button>
          <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "var(--gradient-gold)" }}
          />
        </div>
      </header>

      <section className="flex flex-1 flex-col px-6 py-10">
        <StepView data={data} setData={setData} step={current} user={user?.id} />
      </section>

      <footer className="sticky bottom-0 border-t border-border/50 bg-background/80 px-6 py-4 backdrop-blur">
        <Button onClick={next} disabled={!canContinue || saving} variant="hero" size="lg" className="w-full">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {step === STEPS.length - 1 ? "Finish" : "Continue"}
          {!saving && <ArrowRight className="size-4" />}
        </Button>
      </footer>
    </main>
  );
}

function StepView({
  step, data, setData, user,
}: {
  step: typeof STEPS[number];
  data: Data;
  setData: (d: Data) => void;
  user?: string;
}) {
  switch (step) {
    case "name":
      return (
        <Field title="What should we call you?" hint="Use a name your matches will see.">
          <Input
            autoFocus
            value={data.display_name}
            onChange={(e) => setData({ ...data, display_name: e.target.value })}
            placeholder="Your name"
            className="h-14 bg-surface border-border text-lg"
          />
        </Field>
      );
    case "birthdate":
      return (
        <Field title="When were you born?" hint="You must be 18 or older to use Ventuza.">
          <Input
            type="date"
            value={data.birthdate}
            onChange={(e) => setData({ ...data, birthdate: e.target.value })}
            max={new Date().toISOString().split("T")[0]}
            className="h-14 bg-surface border-border text-lg"
          />
          {data.birthdate && calcAge(data.birthdate) < 18 && (
            <p className="text-sm text-destructive">You must be 18 or older.</p>
          )}
        </Field>
      );
    case "gender":
      return (
        <Field title="How do you identify?" hint="Pick any that fit. You can add your own.">
          <ChipGrid options={GENDER_OPTIONS} selected={data.gender} onToggle={(v) => setData({ ...data, gender: toggle(data.gender, v) })} />
          <div className="mt-4 space-y-2">
            <Label>Custom (optional)</Label>
            <Input value={data.gender_custom} onChange={(e) => setData({ ...data, gender_custom: e.target.value })} placeholder="Describe in your words" className="h-12 bg-surface border-border" />
          </div>
        </Field>
      );
    case "pronouns":
      return (
        <Field title="Your pronouns" hint="Pick any that fit.">
          <ChipGrid options={PRONOUN_OPTIONS} selected={data.pronouns} onToggle={(v) => setData({ ...data, pronouns: toggle(data.pronouns, v) })} />
          <div className="mt-4 space-y-2">
            <Label>Custom (optional)</Label>
            <Input value={data.pronouns_custom} onChange={(e) => setData({ ...data, pronouns_custom: e.target.value })} placeholder="e.g. ze/zir" className="h-12 bg-surface border-border" />
          </div>
        </Field>
      );
    case "orientation":
      return (
        <Field title="Your orientation" hint="Pick any that fit.">
          <ChipGrid options={ORIENTATION_OPTIONS} selected={data.orientation} onToggle={(v) => setData({ ...data, orientation: toggle(data.orientation, v) })} />
        </Field>
      );
    case "looking_for":
      return (
        <Field title="What are you looking for?" hint="Pick all that apply.">
          <ChipGrid options={LOOKING_FOR_OPTIONS} selected={data.looking_for} onToggle={(v) => setData({ ...data, looking_for: toggle(data.looking_for, v) })} />
        </Field>
      );
    case "interests":
      return (
        <Field title="What do you love?" hint="Pick at least 3 interests.">
          <ChipGrid options={INTEREST_OPTIONS} selected={data.interests} onToggle={(v) => setData({ ...data, interests: toggle(data.interests, v) })} />
        </Field>
      );
    case "prompts":
      return <PromptsStep data={data} setData={setData} />;
    case "bio":
      return (
        <Field title="A short bio" hint="A few lines. Be yourself.">
          <Textarea value={data.bio} onChange={(e) => setData({ ...data, bio: e.target.value })} rows={6} maxLength={500} placeholder="What makes you, you…" className="bg-surface border-border" />
          <p className="text-right text-xs text-muted-foreground">{data.bio.length}/500</p>
        </Field>
      );
    case "photos":
      return <PhotosStep data={data} setData={setData} user={user} />;
  }
}

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">{title}</h2>
        {hint && <p className="mt-2 text-muted-foreground">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ChipGrid({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} active={selected.includes(o)} onClick={() => onToggle(o)}>{o}</Chip>
      ))}
    </div>
  );
}

function PromptsStep({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  const slots = [0, 1, 2];
  function setPrompt(i: number, p: Partial<Prompt>) {
    const next = [...data.prompts];
    next[i] = { question: next[i]?.question ?? "", answer: next[i]?.answer ?? "", ...p };
    setData({ ...data, prompts: next });
  }
  const used = data.prompts.map((p) => p?.question);

  return (
    <Field title="Three prompts, in your words." hint="Choose three. Make them sound like you.">
      {slots.map((i) => {
        const cur = data.prompts[i];
        return (
          <div key={i} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
            <select
              value={cur?.question ?? ""}
              onChange={(e) => setPrompt(i, { question: e.target.value })}
              className="h-11 w-full rounded-md bg-surface-elevated px-3 text-sm text-foreground border border-border"
            >
              <option value="">Choose a prompt…</option>
              {PROMPT_OPTIONS.map((q) => (
                <option key={q} value={q} disabled={used.includes(q) && cur?.question !== q}>{q}</option>
              ))}
            </select>
            <Textarea
              value={cur?.answer ?? ""}
              onChange={(e) => setPrompt(i, { answer: e.target.value })}
              rows={2}
              maxLength={200}
              placeholder="Your answer…"
              className="bg-background border-border"
              disabled={!cur?.question}
            />
          </div>
        );
      })}
    </Field>
  );
}

function PhotosStep({ data, setData, user }: { data: Data; setData: (d: Data) => void; user?: string }) {
  const [uploading, setUploading] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const out: Record<string, string> = {};
      for (const p of data.photos) {
        const { data: s } = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
        if (s?.signedUrl) out[p] = s.signedUrl;
      }
      setSigned(out);
    })();
  }, [data.photos]);

  async function handleUpload(files: FileList | null) {
    if (!files || !user) return;
    if (data.photos.length + files.length > 6) return toast.error("Up to 6 photos.");
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        added.push(path);
      }
      setData({ ...data, photos: [...data.photos, ...added] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function remove(path: string) {
    await supabase.storage.from("profile-photos").remove([path]);
    setData({ ...data, photos: data.photos.filter((p) => p !== path) });
  }

  return (
    <Field title="Add your photos" hint="Up to 6. The first one is your primary.">
      <div className="grid grid-cols-3 gap-3">
        {data.photos.map((p, i) => (
          <div key={p} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-surface">
            {signed[p] && <img src={signed[p]} alt="" className="size-full object-cover" />}
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">Main</span>
            )}
            <button onClick={() => remove(p)} aria-label="Remove photo" className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground backdrop-blur hover:bg-destructive hover:text-destructive-foreground">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {data.photos.length < 6 && (
          <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
            <span className="text-xs">Add photo</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          </label>
        )}
      </div>
    </Field>
  );
}
