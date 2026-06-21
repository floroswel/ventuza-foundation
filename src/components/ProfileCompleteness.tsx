import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";

type Check = { key: string; label: string; done: boolean; href?: string };

export function ProfileCompleteness({ profile, onEdit }: { profile: any; onEdit: () => void }) {
  const checks: Check[] = useMemo(() => [
    { key: "photos", label: "Adaugă cel puțin 3 poze", done: (profile.photos?.length ?? 0) >= 3 },
    { key: "bio", label: "Scrie un bio", done: !!profile.bio && profile.bio.length > 30 },
    { key: "prompts", label: "Răspunde la un prompt", done: !!profile.prompts?.some((p: any) => p.answer?.trim()) },
    { key: "interests", label: "Alege minim 3 interese", done: (profile.interests?.length ?? 0) >= 3 },
    { key: "tribes", label: "Selectează un tribe", done: (profile.tribes?.length ?? 0) > 0 },
    { key: "stats", label: "Completează stats (înălțime/body)", done: !!(profile.height_cm || profile.body_type) },
    { key: "verified", label: "Verifică-ți contul", done: !!profile.verified_at },
  ], [profile]);

  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter((c) => !c.done);

  if (pct === 100) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Profil complet</p>
          <p className="mt-1 font-display text-2xl">{pct}%</p>
        </div>
        <button
          onClick={onEdit}
          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Completează
        </button>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-4 space-y-2">
        {missing.slice(0, 4).map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Circle className="size-4 shrink-0" />
            <span>{c.label}</span>
          </li>
        ))}
        {checks.filter((c) => c.done).slice(0, 2).map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm text-foreground/70">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            <span className="line-through opacity-60">{c.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
