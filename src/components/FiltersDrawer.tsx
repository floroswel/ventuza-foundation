import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/Chip";
import {
  GENDER_OPTIONS, ORIENTATION_OPTIONS, LOOKING_FOR_OPTIONS,
  TRIBE_OPTIONS, BODY_TYPE_OPTIONS, POSITION_OPTIONS,
} from "@/lib/profile-options";
import { DEFAULT_FILTERS, type DiscoverFilters } from "@/lib/discover";

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function FiltersDrawer({
  open, onClose, value, onApply,
}: {
  open: boolean;
  onClose: () => void;
  value: DiscoverFilters;
  onApply: (f: DiscoverFilters) => void;
}) {
  const [draft, setDraft] = useState<DiscoverFilters>(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background/95 backdrop-blur">
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="size-5" />
        </button>
        <h2 className="font-display text-lg">Filters</h2>
        <button onClick={() => setDraft(DEFAULT_FILTERS)} className="text-sm text-primary hover:underline">
          Reset
        </button>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        {/* quick toggles */}
        <section className="flex flex-wrap gap-2">
          <Toggle active={draft.lookingNowOnly} onClick={() => setDraft({ ...draft, lookingNowOnly: !draft.lookingNowOnly })}>
            <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-rose-500 shadow-[0_0_6px_rgb(244,63,94)]" />
            Right now
          </Toggle>
          <Toggle active={draft.verifiedOnly} onClick={() => setDraft({ ...draft, verifiedOnly: !draft.verifiedOnly })}>
            ✓ Verified only
          </Toggle>
          <Toggle active={draft.withPhotoOnly} onClick={() => setDraft({ ...draft, withPhotoOnly: !draft.withPhotoOnly })}>
            With photo
          </Toggle>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Distance</Label>
            <span className="text-sm text-primary">{draft.maxDistanceKm} km</span>
          </div>
          <input type="range" min={1} max={500} value={draft.maxDistanceKm}
            onChange={(e) => setDraft({ ...draft, maxDistanceKm: Number(e.target.value) })}
            className="accent-[var(--primary)] w-full" />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Age range</Label>
            <span className="text-sm text-primary">{draft.minAge} – {draft.maxAge}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={18} max={120} value={draft.minAge}
              onChange={(e) => setDraft({ ...draft, minAge: Math.min(Number(e.target.value), draft.maxAge) })}
              className="accent-[var(--primary)] w-full" />
            <input type="range" min={18} max={120} value={draft.maxAge}
              onChange={(e) => setDraft({ ...draft, maxAge: Math.max(Number(e.target.value), draft.minAge) })}
              className="accent-[var(--primary)] w-full" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Height</Label>
            <span className="text-sm text-primary">
              {draft.minHeight ?? 140}cm – {draft.maxHeight ?? 210}cm
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={140} max={210} value={draft.minHeight ?? 140}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDraft({ ...draft, minHeight: v, maxHeight: Math.max(v, draft.maxHeight ?? 210) });
              }}
              className="accent-[var(--primary)] w-full" />
            <input type="range" min={140} max={210} value={draft.maxHeight ?? 210}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDraft({ ...draft, maxHeight: v, minHeight: Math.min(v, draft.minHeight ?? 140) });
              }}
              className="accent-[var(--primary)] w-full" />
          </div>
        </section>

        <ChipSection label="Tribes" options={TRIBE_OPTIONS} value={draft.tribes} onChange={(v) => setDraft({ ...draft, tribes: v })} />
        <ChipSection label="Body type" options={BODY_TYPE_OPTIONS} value={draft.bodyTypes} onChange={(v) => setDraft({ ...draft, bodyTypes: v })} />
        <ChipSection label="Position" options={POSITION_OPTIONS} value={draft.positions} onChange={(v) => setDraft({ ...draft, positions: v })} />
        {/* Filtru HIV status: eliminat — Ventuza nu procesează datele HIV. */}
        <ChipSection label="Looking for" options={LOOKING_FOR_OPTIONS} value={draft.lookingFor} onChange={(v) => setDraft({ ...draft, lookingFor: v })} />
        <ChipSection label="Gender" options={GENDER_OPTIONS} value={draft.gender} onChange={(v) => setDraft({ ...draft, gender: v })} />
        <ChipSection label="Orientation" options={ORIENTATION_OPTIONS} value={draft.orientation} onChange={(v) => setDraft({ ...draft, orientation: v })} />
      </div>

      <footer className="border-t border-border/50 px-6 py-4">
        <Button variant="hero" size="lg" className="w-full" onClick={() => { onApply(draft); onClose(); }}>
          Apply filters
        </Button>
      </footer>
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-xs transition-all " +
        (active
          ? "border-primary/60 bg-primary/15 text-primary glow-gold"
          : "border-border bg-surface text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function ChipSection({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <section className="space-y-3">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={value.includes(o)} onClick={() => onChange(toggle(value, o))}>{o}</Chip>
        ))}
      </div>
    </section>
  );
}
