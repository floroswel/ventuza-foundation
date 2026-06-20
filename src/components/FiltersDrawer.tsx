import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/Chip";
import {
  GENDER_OPTIONS, ORIENTATION_OPTIONS, LOOKING_FOR_OPTIONS,
} from "@/lib/profile-options";
import type { DiscoverFilters } from "@/lib/discover";

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
        <button
          onClick={() => setDraft({ maxDistanceKm: 100, minAge: 18, maxAge: 60, lookingFor: [], gender: [], orientation: [] })}
          className="text-sm text-primary hover:underline"
        >
          Reset
        </button>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        {/* distance */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Distance</Label>
            <span className="text-sm text-primary">{draft.maxDistanceKm} km</span>
          </div>
          <input
            type="range" min={1} max={500} value={draft.maxDistanceKm}
            onChange={(e) => setDraft({ ...draft, maxDistanceKm: Number(e.target.value) })}
            className="accent-[var(--primary)] w-full"
          />
        </section>

        {/* age */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Age range</Label>
            <span className="text-sm text-primary">{draft.minAge} – {draft.maxAge}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={18} max={99} value={draft.minAge}
              onChange={(e) => setDraft({ ...draft, minAge: Math.min(Number(e.target.value), draft.maxAge) })}
              className="accent-[var(--primary)] w-full"
            />
            <input type="range" min={18} max={99} value={draft.maxAge}
              onChange={(e) => setDraft({ ...draft, maxAge: Math.max(Number(e.target.value), draft.minAge) })}
              className="accent-[var(--primary)] w-full"
            />
          </div>
        </section>

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
