import { useState } from "react";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Chip } from "@/components/Chip";
import { ASK_ME_ABOUT_OPTIONS, DEALBREAKER_OPTIONS } from "@/lib/profile-lifestyle-options";

type Vibes = {
  ask_me_about?: string[] | null;
  dealbreakers?: string[] | null;
  ideal_match?: string | null;
};

type Props = { userId: string; vibes: Vibes; onChange: (next: Vibes) => void };

function toggle<T>(arr: T[] | null | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

export function DateVibesCard({ userId, vibes, onChange }: Props) {
  const [form, setForm] = useState<Vibes>(vibes);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange(form);
    setOpen(false);
    toast.success("Date vibes salvate.");
  }

  const filled =
    (form.ask_me_about?.length ?? 0) + (form.dealbreakers?.length ?? 0) + (form.ideal_match ? 1 : 0);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Heart className="size-4 text-primary" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Date vibes</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-xs text-primary underline">
          {open ? "Închide" : filled === 0 ? "Adaugă" : "Editează"}
        </button>
      </div>

      {!open && filled > 0 && (
        <div className="mt-3 space-y-3">
          {form.ideal_match && (
            <p className="rounded-xl border border-border bg-background p-3 text-sm italic text-foreground/85">
              "{form.ideal_match}"
            </p>
          )}
          {form.ask_me_about && form.ask_me_about.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Ask me about</p>
              <div className="flex flex-wrap gap-1.5">
                {form.ask_me_about.map((v) => <Chip key={v} active>💬 {v}</Chip>)}
              </div>
            </div>
          )}
          {form.dealbreakers && form.dealbreakers.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Dealbreakers</p>
              <div className="flex flex-wrap gap-1.5">
                {form.dealbreakers.map((v) => (
                  <span key={v} className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive">
                    🚫 {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Cum arată matchul ideal pentru tine?</p>
            <textarea
              value={form.ideal_match ?? ""}
              onChange={(e) => setForm({ ...form, ideal_match: e.target.value })}
              rows={3}
              maxLength={240}
              placeholder="Ex: Cineva curios, cu simțul umorului, care preferă plimbări lungi la apus..."
              className="w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Întreabă-mă despre</p>
            <div className="flex flex-wrap gap-1.5">
              {ASK_ME_ABOUT_OPTIONS.map((o) => (
                <Chip key={o} active={form.ask_me_about?.includes(o)} onClick={() => setForm({ ...form, ask_me_about: toggle(form.ask_me_about, o) })}>
                  {o}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Dealbreakers</p>
            <div className="flex flex-wrap gap-1.5">
              {DEALBREAKER_OPTIONS.map((o) => (
                <Chip key={o} active={form.dealbreakers?.includes(o)} onClick={() => setForm({ ...form, dealbreakers: toggle(form.dealbreakers, o) })}>
                  {o}
                </Chip>
              ))}
            </div>
          </div>

          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Salvează
          </button>
        </div>
      )}
    </div>
  );
}
