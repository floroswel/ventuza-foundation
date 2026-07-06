import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Bell, Loader2, Upload, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { moderatePhoto } from "@/lib/verification.functions";
import { useAuth } from "@/lib/auth-context";
import { EnablePushButton } from "@/components/EnablePushButton";
import { showAuthErrorToast } from "@/lib/auth-errors";


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
} from "@/lib/profile-options";
import {
  useOptionLabel,
  canonicalizeOptionValue,
  canonicalizeOptionValues,
} from "@/lib/i18n/option-labels";


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
  relationship_status: string;
  interests: string[];
  prompts: Prompt[];
  bio: string;
  photos: string[];
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
  relationship_status: "",
  interests: [],
  prompts: [],
  bio: "",
  photos: [],
  terms_accepted: false,
};

const STEPS = [
  "basics", // name + birthdate
  "identity", // gender + pronouns + orientation + looking_for + tribes
  "personality", // interests + prompts + bio
  "photos", // photos + terms
] as const;

const STEP_KEYS: Record<(typeof STEPS)[number], string> = {
  basics: "onboarding.step.basics",
  identity: "onboarding.step.identity",
  personality: "onboarding.step.personality",
  photos: "onboarding.step.photos",
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

const STORAGE_KEY = "vz_onboarding_v1";

function Onboarding() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(empty);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [donePush, setDonePush] = useState(false);


  // Hydrate step + data din localStorage la mount (refresh / kill-app safe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { step?: number; data?: Data; uid?: string };
        if (parsed.data) setData({ ...empty, ...parsed.data });
        if (typeof parsed.step === "number") setStep(Math.min(parsed.step, STEPS.length - 1));
      }
    } catch {
      /* corrupt → ignore */
    }
    setHydrated(true);
  }, []);

  // Persist on every change (după hydrate, ca să nu suprascriem cu empty).
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data, uid: user?.id ?? null }));
    } catch {
      /* quota → ignore */
    }
  }, [step, data, hydrated, user?.id]);

  // Guard: dacă userul a terminat deja onboarding-ul, redirect către /discover.
  // În plus, prefill birthdate + display_name dacă există deja în profil
  // (setate la signup) — să nu întrebăm a doua oară.
  const [birthdateLocked, setBirthdateLocked] = useState(false);
  useEffect(() => {
    if (!user || !hydrated) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("onboarding_completed, birthdate, display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!alive || !row) return;
        if (row.onboarding_completed) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* noop */
          }
          navigate({ to: "/discover", replace: true });
          return;
        }
        setData((prev) => ({
          ...prev,
          birthdate: prev.birthdate || (row.birthdate ?? ""),
          display_name: prev.display_name || (row.display_name ?? ""),
        }));
        if (row.birthdate) setBirthdateLocked(true);
      });
    return () => {
      alive = false;
    };
  }, [user?.id, hydrated, navigate]);


  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  const canContinue = useMemo(() => {
    switch (current) {
      case "basics":
        return (
          data.display_name.trim().length >= 2 && !!data.birthdate && calcAge(data.birthdate) >= 18
        );
      case "identity":
        return (
          (data.gender.length > 0 || data.gender_custom.trim().length > 0) &&
          (data.pronouns.length > 0 || data.pronouns_custom.trim().length > 0) &&
          data.orientation.length > 0 &&
          data.looking_for.length > 0
        );
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

    // GDPR: înregistrăm consimțămintele obligatorii (terms/privacy) înainte de update.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null;
    const consents: Array<{ kind: string; version: string; accepted: boolean }> = [
      { kind: "terms", version: "2026-06-22", accepted: true },
      { kind: "privacy", version: "2026-06-22", accepted: true },
    ];
    const { error: consentError } = await supabase
      .from("consent_log")
      .insert(consents.map((c) => ({ user_id: user.id, ...c, user_agent: ua })));
    if (consentError) {
      setSaving(false);
      showAuthErrorToast(t, consentError);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.display_name.trim(),
        birthdate: data.birthdate,
        gender: canonicalizeOptionValues(data.gender),
        gender_custom: data.gender_custom.trim() || null,
        pronouns: canonicalizeOptionValues(data.pronouns),
        pronouns_custom: data.pronouns_custom.trim() || null,
        orientation: canonicalizeOptionValues(data.orientation),
        looking_for: canonicalizeOptionValues(data.looking_for),
        tribes: canonicalizeOptionValues(data.tribes),
        body_type: data.body_type ? canonicalizeOptionValue(data.body_type) : null,
        height_cm: data.height_cm,
        weight_kg: data.weight_kg,
        ethnicity: data.ethnicity ? canonicalizeOptionValue(data.ethnicity) : null,
        position: data.position ? canonicalizeOptionValue(data.position) : null,
        relationship_status: data.relationship_status
          ? canonicalizeOptionValue(data.relationship_status)
          : null,
        interests: canonicalizeOptionValues(data.interests),
        bio: data.bio.trim(),
        prompts: data.prompts.map((p) => ({
          question: canonicalizeOptionValue(p.question),
          answer: p.answer,
        })),
        photos: data.photos,

        terms_accepted_version: "2026-06-22",
        terms_accepted_at: new Date().toISOString(),
        privacy_accepted_version: "2026-06-22",
        privacy_accepted_at: new Date().toISOString(),
        onboarding_completed: true,
      })
      .eq("id", user.id);
    if (error) {
      setSaving(false);
      showAuthErrorToast(t, error);
      return;
    }

    setSaving(false);

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    toast.success(t("onboarding.toast.ready"));
    // Înainte de a duce userul în /discover, oferim activarea push (consimțământ
    // recorded prin EnablePushButton → savePushSubscription → record_consent).
    setDonePush(true);
  }

  function back() {
    if (step === 0) navigate({ to: "/" });
    else setStep(step - 1);
  }

  if (donePush) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-primary/40 bg-surface glow-gold">
          <Bell className="size-7 text-primary" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="wordmark text-3xl font-medium">{t("onboarding.done.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("onboarding.done.hint")}</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <EnablePushButton className="w-full" enableOnly />
          <Button
            size="lg"
            onClick={() => navigate({ to: "/discover", replace: true })}
          >
            {t("onboarding.continue")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <button
            onClick={back}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-4" /> {t("onboarding.back")}
          </button>
          <span className="text-xs text-muted-foreground">
            {t(STEP_KEYS[current])} · {step + 1}/{STEPS.length}
          </span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "var(--gradient-gold)" }}
          />
        </div>
      </header>

      <section className="flex flex-1 flex-col px-6 py-10">
        <StepView data={data} setData={setData} step={current} user={user?.id} birthdateLocked={birthdateLocked} />
      </section>

      <footer className="sticky bottom-0 border-t border-border/50 bg-background/80 px-6 py-4 backdrop-blur">
        <Button
          onClick={next}
          disabled={!canContinue || saving}
          variant="hero"
          size="lg"
          className="w-full"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {step === STEPS.length - 1 ? t("onboarding.finish") : t("onboarding.continue")}
          {!saving && <ArrowRight className="size-4" />}
        </Button>
      </footer>
    </main>
  );
}


function StepView({
  step,
  data,
  setData,
  user,
  birthdateLocked,
}: {
  step: (typeof STEPS)[number];
  data: Data;
  setData: (d: Data) => void;
  user?: string;
  birthdateLocked?: boolean;
}) {
  const { t } = useTranslation();

  switch (step) {
    case "basics":
      return (
        <div className="mx-auto w-full max-w-lg space-y-6">
          <div>
            <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">
              {t("onboarding.basics.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("onboarding.basics.hint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("onboarding.basics.nameLabel")}</Label>
            <Input
              autoFocus
              value={data.display_name}
              onChange={(e) => setData({ ...data, display_name: e.target.value })}
              placeholder={t("onboarding.basics.namePlaceholder")}
              className="h-14 bg-surface border-border text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("onboarding.basics.birthLabel")}</Label>
            <Input
              type="date"
              value={data.birthdate}
              onChange={(e) => setData({ ...data, birthdate: e.target.value })}
              max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split("T")[0]}
              className="h-14 bg-surface border-border text-lg disabled:opacity-100"
              disabled={birthdateLocked}
              readOnly={birthdateLocked}
            />
            {birthdateLocked && (
              <p className="text-xs text-muted-foreground">{t("onboarding.basics.birthLocked")}</p>
            )}
            {data.birthdate && calcAge(data.birthdate) < 18 && (
              <p className="text-sm text-destructive">{t("onboarding.basics.minAge")}</p>
            )}
          </div>
        </div>
      );

    case "identity":
      return (
        <div className="mx-auto w-full max-w-lg space-y-8">
          <div>
            <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">
              {t("onboarding.identity.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("onboarding.identity.hint")}</p>
          </div>
          <div className="space-y-3">
            <Label>{t("onboarding.identity.gender")}</Label>
            <ChipGrid
              options={GENDER_OPTIONS}
              selected={data.gender}
              onToggle={(v) => setData({ ...data, gender: toggle(data.gender, v) })}
            />
            <Input
              value={data.gender_custom}
              onChange={(e) => setData({ ...data, gender_custom: e.target.value })}
              placeholder={t("onboarding.identity.genderCustom")}
              className="h-11 bg-surface border-border"
            />
          </div>
          <div className="space-y-3">
            <Label>{t("onboarding.identity.pronouns")}</Label>
            <ChipGrid
              options={PRONOUN_OPTIONS}
              selected={data.pronouns}
              onToggle={(v) => setData({ ...data, pronouns: toggle(data.pronouns, v) })}
            />
            <Input
              value={data.pronouns_custom}
              onChange={(e) => setData({ ...data, pronouns_custom: e.target.value })}
              placeholder={t("onboarding.identity.pronounsCustom")}
              className="h-11 bg-surface border-border"
            />
          </div>
          <div className="space-y-3">
            <Label>{t("onboarding.identity.orientation")}</Label>
            <ChipGrid
              options={ORIENTATION_OPTIONS}
              selected={data.orientation}
              onToggle={(v) => setData({ ...data, orientation: toggle(data.orientation, v) })}
            />
          </div>
          <div className="space-y-3">
            <Label>{t("onboarding.intent.looking")}</Label>
            <ChipGrid
              options={LOOKING_FOR_OPTIONS}
              selected={data.looking_for}
              onToggle={(v) => setData({ ...data, looking_for: toggle(data.looking_for, v) })}
            />
          </div>
          <div className="space-y-3">
            <Label>
              {t("onboarding.intent.tribes")}{" "}
              <span className="text-muted-foreground font-normal">
                {t("onboarding.intent.optional")}
              </span>
            </Label>
            <ChipGrid
              options={TRIBE_OPTIONS}
              selected={data.tribes}
              onToggle={(v) => setData({ ...data, tribes: toggle(data.tribes, v) })}
            />
          </div>
        </div>
      );


    case "personality":
      return (
        <div className="mx-auto w-full max-w-lg space-y-8">
          <div>
            <h2 className="wordmark text-3xl font-medium leading-tight sm:text-4xl">
              {t("onboarding.personality.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("onboarding.personality.hint")}</p>
          </div>
          <div className="space-y-3">
            <Label>
              {t("onboarding.personality.interests")}{" "}
              <span className="text-muted-foreground font-normal">
                {t("onboarding.personality.min3")}
              </span>
            </Label>
            <ChipGrid
              options={INTEREST_OPTIONS}
              selected={data.interests}
              onToggle={(v) => setData({ ...data, interests: toggle(data.interests, v) })}
            />
          </div>
          <div className="space-y-2">
            <Label>
              {t("onboarding.personality.bio")}{" "}
              <span className="text-muted-foreground font-normal">
                {t("onboarding.personality.optional")}
              </span>
            </Label>
            <Textarea
              value={data.bio}
              onChange={(e) => setData({ ...data, bio: e.target.value })}
              rows={5}
              maxLength={500}
              placeholder={t("onboarding.personality.bioPlaceholder")}
              className="bg-surface border-border"
            />
            <p className="text-right text-xs text-muted-foreground">{data.bio.length}/500</p>
          </div>
        </div>
      );

    case "photos":
      return (
        <div className="space-y-6">
          <PhotosStep data={data} setData={setData} user={user} />
          <label className="mx-auto flex w-full max-w-lg items-start gap-3 rounded-xl border border-border bg-surface/40 p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={data.terms_accepted}
              onChange={(e) => setData({ ...data, terms_accepted: e.target.checked })}
            />
            <span className="text-xs leading-relaxed text-foreground/85">
              {t("onboarding.photos.terms")}{" "}
              <a href="/legal/terms" target="_blank" className="text-primary underline">
                {t("onboarding.photos.termsLink")}
              </a>
              ,{" "}
              <a href="/legal/privacy" target="_blank" className="text-primary underline">
                {t("onboarding.photos.privacyLink")}
              </a>{" "}
              {t("onboarding.photos.termsAnd")}{" "}
              <a href="/legal/community" target="_blank" className="text-primary underline">
                {t("onboarding.photos.communityLink")}
              </a>
              {t("onboarding.photos.termsConfirm")}
            </span>
          </label>
        </div>
      );
  }
}


function Field({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const t = useOptionLabel();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} active={selected.includes(o)} onClick={() => onToggle(o)}>
          {t(o)}
        </Chip>
      ))}
    </div>
  );
}

function PromptsInline({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  const t = useOptionLabel();
  const { t: tr } = useTranslation();
  const slots = [0, 1, 2];
  function setPrompt(i: number, p: Partial<Prompt>) {
    const next = [...data.prompts];
    next[i] = { question: next[i]?.question ?? "", answer: next[i]?.answer ?? "", ...p };
    setData({ ...data, prompts: next });
  }
  const used = data.prompts.map((p) => p?.question);

  return (
    <div className="space-y-3">
      <Label>{tr("onboarding.prompts.title")}</Label>
      {slots.map((i) => {
        const cur = data.prompts[i];
        return (
          <div key={i} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
            <select
              value={cur?.question ?? ""}
              onChange={(e) => setPrompt(i, { question: e.target.value })}
              className="h-11 w-full rounded-md bg-surface-elevated px-3 text-sm text-foreground border border-border"
            >
              <option value="">{tr("onboarding.prompts.choose")}</option>
              {PROMPT_OPTIONS.map((q) => (
                <option key={q} value={q} disabled={used.includes(q) && cur?.question !== q}>
                  {t(q)}
                </option>

              ))}
            </select>
            <Textarea
              value={cur?.answer ?? ""}
              onChange={(e) => setPrompt(i, { answer: e.target.value })}
              rows={2}
              maxLength={200}
              placeholder={tr("onboarding.prompts.answer")}
              className="bg-background border-border"
              disabled={!cur?.question}
            />
          </div>
        );
      })}
    </div>
  );
}

function PhotosStep({
  data,
  setData,
  user,
}: {
  data: Data;
  setData: (d: Data) => void;
  user?: string;
}) {
  const { t } = useTranslation();

  const [uploading, setUploading] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const moderate = useServerFn(moderatePhoto);

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
    if (data.photos.length + files.length > 6) return toast.error(t("onboarding.photos.tooMany"));
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024) {
          toast.error(t("onboarding.photos.tooBig", { name: file.name }));
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("profile-photos")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (error) {
          showAuthErrorToast(t, error);
          continue;
        }

        // AI moderation cu retry. Dacă AI-ul e DOWN după retry-uri, NU blocăm signup-ul:
        // pătrăm poza, dar o marcăm pentru review manual (insert în risk_flags) și
        // anunțăm userul. Poza rămâne privată până la review (RLS profile photos).
        let modOk = false;
        let modBlocked = false;
        let lastErr = "";
        try {
          const { data: signedData } = await supabase.storage
            .from("profile-photos")
            .createSignedUrl(path, 300);
          if (signedData?.signedUrl) {
            for (let attempt = 0; attempt < 3 && !modOk && !modBlocked; attempt++) {
              try {
                const mod = await moderate({ data: { photoUrl: signedData.signedUrl } });
                if (mod.allowed) {
                  modOk = true;
                  break;
                }
                modBlocked = true;
                await supabase.storage.from("profile-photos").remove([path]);
                toast.error(
                  t("onboarding.photos.rejected", {
                    reason: mod.reason || t("onboarding.photos.rejectedDefault"),
                  }),
                );

              } catch (e) {
                lastErr = (e as Error).message;
                if (attempt < 2)
                  await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
              }
            }
          }
        } catch (e) {
          lastErr = (e as Error).message;
        }
        if (modBlocked) continue;
        if (!modOk) {
          // Fail-open: păstrăm poza, marcăm pentru review manual.
          try {
            await supabase.from("risk_flags").insert({
              user_id: user,
              kind: "photo_pending_review",
              severity: "low",
              meta: { path, reason: "ai_moderation_unavailable", err: lastErr.slice(0, 200) },
            } as never);
          } catch {
            /* tabel poate avea schema diferită; nu blocăm */
          }
          toast.message(t("onboarding.photos.pending"), {
            description: t("onboarding.photos.pendingDesc"),
          });

        }
        added.push(path);
      }
      if (added.length) setData({ ...data, photos: [...data.photos, ...added] });
    } catch (e) {
      showAuthErrorToast(t, e instanceof Error ? e : new Error(t("onboarding.photos.uploadFailed")));
    } finally {
      setUploading(false);
    }
  }

  async function remove(path: string) {
    await supabase.storage.from("profile-photos").remove([path]);
    setData({ ...data, photos: data.photos.filter((p) => p !== path) });
  }

  return (
    <Field title={t("onboarding.photos.title")} hint={t("onboarding.photos.hint")}>
      <div className="grid grid-cols-3 gap-3">
        {data.photos.map((p, i) => (
          <div
            key={p}
            className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-surface"
          >
            {signed[p] && <img src={signed[p]} alt="" className="size-full object-cover" />}
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {t("onboarding.photos.main")}
              </span>
            )}
            <button
              onClick={() => remove(p)}
              aria-label={t("onboarding.photos.remove")}
              className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground backdrop-blur hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {data.photos.length < 6 && (
          <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            <span className="text-xs">{t("onboarding.photos.add")}</span>
            <input

              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        )}
      </div>
    </Field>
  );
}
