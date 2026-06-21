import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Chip } from "@/components/Chip";
import {
  ZODIAC_OPTIONS, LANGUAGE_OPTIONS, EDUCATION_OPTIONS, RELIGION_OPTIONS,
  POLITICS_OPTIONS, CHILDREN_OPTIONS, PET_OPTIONS, FREQUENCY_OPTIONS,
  WORKOUT_OPTIONS, DIET_OPTIONS, SLEEP_OPTIONS,
} from "@/lib/profile-lifestyle-options";

type Facts = {
  zodiac?: string | null;
  languages?: string[] | null;
  education?: string | null;
  school?: string | null;
  job_title?: string | null;
  company?: string | null;
  religion?: string | null;
  politics?: string | null;
  children?: string | null;
  pets?: string[] | null;
  drinking?: string | null;
  smoking?: string | null;
  cannabis?: string | null;
  drugs?: string | null;
  workout?: string | null;
  diet?: string | null;
  sleep_schedule?: string | null;
};

type Props = {
  userId: string;
  facts: Facts;
  onChange: (next: Facts) => void;
};

function toggle<T>(arr: T[] | null | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

export function LifestyleFactsCard({ userId, facts, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Facts>(facts);
  const [open, setOpen] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange(form);
    setOpen(false);
    toast.success("Lifestyle actualizat.");
  }

  const filled = Object.values(facts).filter((v) => Array.isArray(v) ? v.length > 0 : !!v).length;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Lifestyle · {filled}/17</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-xs text-primary underline">
          {open ? "Închide" : filled === 0 ? "Adaugă" : "Editează"}
        </button>
      </div>

      {!open && filled > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {facts.zodiac && <Chip active>♈ {facts.zodiac}</Chip>}
          {facts.languages?.slice(0, 3).map((l) => <Chip key={l} active>🗣 {l}</Chip>)}
          {facts.job_title && <Chip active>💼 {facts.job_title}</Chip>}
          {facts.education && <Chip active>🎓 {facts.education}</Chip>}
          {facts.religion && <Chip active>🙏 {facts.religion}</Chip>}
          {facts.children && <Chip active>👶 {facts.children}</Chip>}
          {facts.pets?.slice(0, 2).map((p) => <Chip key={p} active>🐾 {p}</Chip>)}
          {facts.drinking && <Chip active>🍷 {facts.drinking}</Chip>}
          {facts.smoking && <Chip active>🚬 {facts.smoking}</Chip>}
          {facts.cannabis && <Chip active>🌿 {facts.cannabis}</Chip>}
          {facts.workout && <Chip active>💪 {facts.workout}</Chip>}
          {facts.diet && <Chip active>🥗 {facts.diet}</Chip>}
          {facts.sleep_schedule && <Chip active>🌙 {facts.sleep_schedule}</Chip>}
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          <Single label="Zodiac" value={form.zodiac} options={ZODIAC_OPTIONS} onChange={(v) => setForm({ ...form, zodiac: v })} />
          <Multi label="Limbi" values={form.languages ?? []} options={LANGUAGE_OPTIONS} onChange={(v) => setForm({ ...form, languages: v })} />
          <Single label="Educație" value={form.education} options={EDUCATION_OPTIONS} onChange={(v) => setForm({ ...form, education: v })} />
          <Text label="Școală / universitate" value={form.school ?? ""} onChange={(v) => setForm({ ...form, school: v })} />
          <Text label="Job" value={form.job_title ?? ""} onChange={(v) => setForm({ ...form, job_title: v })} />
          <Text label="Companie" value={form.company ?? ""} onChange={(v) => setForm({ ...form, company: v })} />
          <Single label="Religie" value={form.religion} options={RELIGION_OPTIONS} onChange={(v) => setForm({ ...form, religion: v })} />
          <Single label="Politică" value={form.politics} options={POLITICS_OPTIONS} onChange={(v) => setForm({ ...form, politics: v })} />
          <Single label="Copii" value={form.children} options={CHILDREN_OPTIONS} onChange={(v) => setForm({ ...form, children: v })} />
          <Multi label="Animale" values={form.pets ?? []} options={PET_OPTIONS} onChange={(v) => setForm({ ...form, pets: v })} />
          <Single label="Băut" value={form.drinking} options={FREQUENCY_OPTIONS} onChange={(v) => setForm({ ...form, drinking: v })} />
          <Single label="Fumat" value={form.smoking} options={FREQUENCY_OPTIONS} onChange={(v) => setForm({ ...form, smoking: v })} />
          <Single label="Cannabis" value={form.cannabis} options={FREQUENCY_OPTIONS} onChange={(v) => setForm({ ...form, cannabis: v })} />
          <Single label="Alte droguri" value={form.drugs} options={FREQUENCY_OPTIONS} onChange={(v) => setForm({ ...form, drugs: v })} />
          <Single label="Sport" value={form.workout} options={WORKOUT_OPTIONS} onChange={(v) => setForm({ ...form, workout: v })} />
          <Single label="Dietă" value={form.diet} options={DIET_OPTIONS} onChange={(v) => setForm({ ...form, diet: v })} />
          <Single label="Somn" value={form.sleep_schedule} options={SLEEP_OPTIONS} onChange={(v) => setForm({ ...form, sleep_schedule: v })} />

          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />} Salvează
          </button>
        </div>
      )}
    </div>
  );
}

function Single({ label, value, options, onChange }: { label: string; value: string | null | undefined; options: string[]; onChange: (v: string | null) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onChange(value === o ? null : o)}>{o}</Chip>
        ))}
      </div>
    </div>
  );
}

function Multi({ label, values, options, onChange }: { label: string; values: string[]; options: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o} active={values.includes(o)} onClick={() => onChange(toggle(values, o))}>{o}</Chip>
        ))}
      </div>
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
