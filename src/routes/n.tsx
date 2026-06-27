import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setMyHealth } from "@/lib/health.functions";
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

export const Route = createFileRoute("/n")({
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
  health_consent: boolean;
  terms_accepted: boolean;
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
  health_consent: false,
  terms_accepted: false,
};

const STEPS = [
  "basics",       // name + birthdate
  "identity",     // gender + pronouns + orientation
  "intent",       // looking_for + tribes
  "stats",        // body/position/height/weight/ethnicity/relationship + health
  "personality",  // interests + prompts + bio
  "photos",       // photos + terms
] as const;

const STEP_LABELS: Record<typeof STEPS[number], string> = {
  basics: "Despre tine",
  identity: "Identitate",
  intent: "Ce cauți",
  stats: "Profil fizic",
  personality: "Personalitate",
  photos: "Poze",
};

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
      case "basics":
        return data.display_name.trim().length >= 2 && !!data.birthdate && calcAge(data.birthdate) >= 18;
      case "identity":
        return (data.gender.length > 0 || data.gender_custom.trim().length > 0)
          && (data.pronouns.length > 0 || data.pronouns_custom.trim().length > 0)
          && data.orientation.length > 0;
      case "intent":
        return data.looking_for.length > 0;
      case "stats":
        return !data.hiv_status || data.health_consent;
      case "personality":
        return data.interests.length >= 3;
      case "photos":
        return data.photos.length >= 1 && data.terms_accepted;
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

    // GDPR: ÎNTÂI înregistrăm consimțământul (inclusiv health_data dacă userul a acceptat),
    // pentru ca triggerul `enforce_health_consent` de pe `profiles` să accepte scrierea
    // câmpurilor health-gated în aceeași tranzacție logică. Vezi AGENTS.md.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null;
    const consents: Array<{ kind: string; version: string; accepted: boolean }> = [
      { kind: "terms", version: "2026-06-22", accepted: true },
      { kind: "privacy", version: "2026-06-22", accepted: true },
    ];
    const wantsHealth = Boolean(data.hiv_status) && data.health_consent;
    if (wantsHealth) {
      consents.push({ kind: "health_data", version: "2026-06-22", accepted: true });
    }
    const { error: consentError } = await supabase.from("consent_log").insert(
      consents.map((c) => ({ user_id: user.id, ...c, user_agent: ua })),
    );
    if (consentError) {
      setSaving(false);
      return toast.error(consentError.message);
    }

    const { error } = await supabase.from("profiles").update({
      display_name: data.display_name.trim(),
      birthdate: data.birthdate,
      gender: data.gender,
      gender_custom: data.gender_custom.trim() || null,
      pronouns: data.pronouns,
      pronouns_custom: data.pronouns_custom.trim() || null,
      orientation: data.orientation,
      looking_for: data.looking_for,
      tribes: data.tribes,
      body_type: data.body_type || null,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      ethnicity: data.ethnicity || null,
      position: data.position || null,
      // hiv_status / hiv_test_date sunt cifrate la nivel de coloană și se
      // scriu DOAR prin setMyHealth (server fn → set_user_health RPC), nu
      // direct prin update pe profiles. Vezi AGENTS.md "CIFRARE DATE SĂNĂTATE".
      relationship_status: data.relationship_status || null,
      interests: data.interests,
      bio: data.bio.trim(),
      prompts: data.prompts,
      photos: data.photos,
      health_data_consent_at: wantsHealth ? new Date().toISOString() : null,
      terms_accepted_version: "2026-06-22",
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_version: "2026-06-22",
      privacy_accepted_at: new Date().toISOString(),
      onboarding_completed: true,
    }).eq("id", user.id);
    if (error) { setSaving(false); return toast.error(error.message); }

    if (wantsHealth && data.hiv_status) {
      const res = await setMyHealth({ data: { hiv_status: data.hiv_status, hiv_test_date: null } });
      if (!res.ok) {
        setSaving(false);
        return toast.error(res.message);
      }
    }
    setSaving(false);

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
            <ArrowLeft className="size-4" /> Înapoi
          </button>
          <span className="text-xs text-muted-foreground">{STEP_LABELS[current]} · {step + 1}/{STEPS.length}</span>
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
    case "basics":
      return (
        <div className="mx-auto w-full max-w-lg space-y-6">
          <div>
            <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">Să te cunoaștem</h2>
            <p className="mt-2 text-muted-foreground">Numele și data nașterii. Trebuie să ai 18+.</p>
          </div>
          <div className="space-y-2">
            <Label>Cum te numești?</Label>
            <Input
              autoFocus
              value={data.display_name}
              onChange={(e) => setData({ ...data, display_name: e.target.value })}
              placeholder="Numele tău"
              className="h-14 bg-surface border-border text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label>Data nașterii</Label>
            <Input
              type="date"
              value={data.birthdate}
              onChange={(e) => setData({ ...data, birthdate: e.target.value })}
              max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split("T")[0]}
              className="h-14 bg-surface border-border text-lg"
            />
            {data.birthdate && calcAge(data.birthdate) < 18 && (
              <p className="text-sm text-destructive">Trebuie să ai cel puțin 18 ani.</p>
            )}
          </div>
        </div>
      );

    case "identity":
      return (
        <div className="mx-auto w-full max-w-lg space-y-8">
          <div>
            <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">Identitatea ta</h2>
            <p className="mt-2 text-muted-foreground">Gen, pronume și orientare. Alege orice ți se potrivește.</p>
          </div>
          <div className="space-y-3">
            <Label>Gen</Label>
            <ChipGrid options={GENDER_OPTIONS} selected={data.gender} onToggle={(v) => setData({ ...data, gender: toggle(data.gender, v) })} />
            <Input value={data.gender_custom} onChange={(e) => setData({ ...data, gender_custom: e.target.value })} placeholder="Personalizat (opțional)" className="h-11 bg-surface border-border" />
          </div>
          <div className="space-y-3">
            <Label>Pronume</Label>
            <ChipGrid options={PRONOUN_OPTIONS} selected={data.pronouns} onToggle={(v) => setData({ ...data, pronouns: toggle(data.pronouns, v) })} />
            <Input value={data.pronouns_custom} onChange={(e) => setData({ ...data, pronouns_custom: e.target.value })} placeholder="ex: ze/zir (opțional)" className="h-11 bg-surface border-border" />
          </div>
          <div className="space-y-3">
            <Label>Orientare</Label>
            <ChipGrid options={ORIENTATION_OPTIONS} selected={data.orientation} onToggle={(v) => setData({ ...data, orientation: toggle(data.orientation, v) })} />
          </div>
        </div>
      );

    case "intent":
      return (
        <div className="mx-auto w-full max-w-lg space-y-8">
          <div>
            <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">Ce cauți?</h2>
            <p className="mt-2 text-muted-foreground">Alege orice se potrivește. Triburile sunt opționale.</p>
          </div>
          <div className="space-y-3">
            <Label>Caut</Label>
            <ChipGrid options={LOOKING_FOR_OPTIONS} selected={data.looking_for} onToggle={(v) => setData({ ...data, looking_for: toggle(data.looking_for, v) })} />
          </div>
          <div className="space-y-3">
            <Label>Triburi <span className="text-muted-foreground font-normal">(opțional)</span></Label>
            <ChipGrid options={TRIBE_OPTIONS} selected={data.tribes} onToggle={(v) => setData({ ...data, tribes: toggle(data.tribes, v) })} />
          </div>
        </div>
      );

    case "stats":
      return (
        <div className="mx-auto w-full max-w-lg space-y-6">
          <div>
            <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">Profilul tău fizic</h2>
            <p className="mt-2 text-muted-foreground">Totul este opțional. Arată doar ce vrei tu.</p>
          </div>
          <div className="space-y-2">
            <Label>Tip corp</Label>
            <ChipGrid options={BODY_TYPE_OPTIONS} selected={data.body_type ? [data.body_type] : []} onToggle={(v) => setData({ ...data, body_type: data.body_type === v ? "" : v })} />
          </div>
          <div className="space-y-2">
            <Label>Poziție</Label>
            <ChipGrid options={POSITION_OPTIONS} selected={data.position ? [data.position] : []} onToggle={(v) => setData({ ...data, position: data.position === v ? "" : v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Înălțime (cm)</Label>
              <Input type="number" min={140} max={220} value={data.height_cm ?? ""}
                onChange={(e) => setData({ ...data, height_cm: e.target.value ? Number(e.target.value) : null })}
                className="h-12 bg-surface border-border" />
            </div>
            <div className="space-y-2">
              <Label>Greutate (kg)</Label>
              <Input type="number" min={40} max={200} value={data.weight_kg ?? ""}
                onChange={(e) => setData({ ...data, weight_kg: e.target.value ? Number(e.target.value) : null })}
                className="h-12 bg-surface border-border" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Etnie</Label>
            <ChipGrid options={ETHNICITY_OPTIONS} selected={data.ethnicity ? [data.ethnicity] : []} onToggle={(v) => setData({ ...data, ethnicity: data.ethnicity === v ? "" : v })} />
          </div>
          <div className="space-y-2">
            <Label>Status relație</Label>
            <ChipGrid options={RELATIONSHIP_STATUS_OPTIONS} selected={data.relationship_status ? [data.relationship_status] : []} onToggle={(v) => setData({ ...data, relationship_status: data.relationship_status === v ? "" : v })} />
          </div>
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label>Status HIV <span className="text-muted-foreground font-normal">(opțional)</span></Label>
            <ChipGrid options={HIV_STATUS_OPTIONS} selected={data.hiv_status ? [data.hiv_status] : []} onToggle={(v) => setData({ ...data, hiv_status: data.hiv_status === v ? "" : v })} />
            {data.hiv_status && (
              <label className="mt-3 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3">
                <input type="checkbox" className="mt-1" checked={data.health_consent}
                  onChange={(e) => setData({ ...data, health_consent: e.target.checked })} />
                <span className="text-xs leading-relaxed text-foreground/85">
                  <strong>Consimțământ explicit (GDPR Art. 9):</strong> sunt de acord ca Ventuza
                  să afișeze statusul meu HIV pe profil. Pot retrage oricând din Setări.
                </span>
              </label>
            )}
          </div>
        </div>
      );

    case "personality":
      return (
        <div className="mx-auto w-full max-w-lg space-y-8">
          <div>
            <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">Cine ești</h2>
            <p className="mt-2 text-muted-foreground">Interese și o scurtă bio.</p>
          </div>
          <div className="space-y-3">
            <Label>Interese <span className="text-muted-foreground font-normal">(min. 3)</span></Label>
            <ChipGrid options={INTEREST_OPTIONS} selected={data.interests} onToggle={(v) => setData({ ...data, interests: toggle(data.interests, v) })} />
          </div>
          <div className="space-y-2">
            <Label>Bio scurt <span className="text-muted-foreground font-normal">(opțional)</span></Label>
            <Textarea value={data.bio} onChange={(e) => setData({ ...data, bio: e.target.value })} rows={5} maxLength={500} placeholder="Câteva rânduri despre tine…" className="bg-surface border-border" />
            <p className="text-right text-xs text-muted-foreground">{data.bio.length}/500</p>
          </div>
        </div>
      );

    case "photos":
      return (
        <div className="space-y-6">
          <PhotosStep data={data} setData={setData} user={user} />
          <label className="mx-auto flex w-full max-w-lg items-start gap-3 rounded-xl border border-border bg-surface/40 p-3">
            <input type="checkbox" className="mt-1" checked={data.terms_accepted}
              onChange={(e) => setData({ ...data, terms_accepted: e.target.checked })} />
            <span className="text-xs leading-relaxed text-foreground/85">
              Am citit și accept{" "}
              <a href="/legal/terms" target="_blank" className="text-primary underline">Termenii</a>,{" "}
              <a href="/legal/privacy" target="_blank" className="text-primary underline">Confidențialitatea</a>{" "}
              și{" "}
              <a href="/legal/community" target="_blank" className="text-primary underline">Regulile Comunității</a>.
              Confirm că am cel puțin 18 ani.
            </span>
          </label>
        </div>
      );
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

function PromptsInline({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  const slots = [0, 1, 2];
  function setPrompt(i: number, p: Partial<Prompt>) {
    const next = [...data.prompts];
    next[i] = { question: next[i]?.question ?? "", answer: next[i]?.answer ?? "", ...p };
    setData({ ...data, prompts: next });
  }
  const used = data.prompts.map((p) => p?.question);

  return (
    <div className="space-y-3">
      <Label>3 prompts în cuvintele tale</Label>
      {slots.map((i) => {
        const cur = data.prompts[i];
        return (
          <div key={i} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
            <select
              value={cur?.question ?? ""}
              onChange={(e) => setPrompt(i, { question: e.target.value })}
              className="h-11 w-full rounded-md bg-surface-elevated px-3 text-sm text-foreground border border-border"
            >
              <option value="">Alege un prompt…</option>
              {PROMPT_OPTIONS.map((q) => (
                <option key={q} value={q} disabled={used.includes(q) && cur?.question !== q}>{q}</option>
              ))}
            </select>
            <Textarea
              value={cur?.answer ?? ""}
              onChange={(e) => setPrompt(i, { answer: e.target.value })}
              rows={2}
              maxLength={200}
              placeholder="Răspunsul tău…"
              className="bg-background border-border"
              disabled={!cur?.question}
            />
          </div>
        );
      })}
    </div>
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
    if (data.photos.length + files.length > 6) return toast.error("Maxim 6 poze.");
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
    <Field title="Add your photos" hint="Maxim 6 poze. Prima este principală.">
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
