import { useEffect, useState } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const OPTIONS = ["🎭", "🕶️", "🌙", "🖤", "🔥", "🐺", "🌹", "💫"] as const;

/**
 * „Persoană discretă” — cine nu vrea ca poza reală să apară în liste alege un
 * emoticon care îl reprezintă. Poza rămâne în cont (o poate arăta în chat sau
 * din albumul privat), dar în listele publice apare doar emoticonul.
 */
export function DiscreetAvatarPicker({ userId }: { userId: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("discreet_avatar")
        .eq("id", userId)
        .maybeSingle();
      if (!alive) return;
      setValue((data as { discreet_avatar?: string | null } | null)?.discreet_avatar ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  async function save(next: string | null) {
    setSaving(true);
    const prev = value;
    setValue(next);
    const { error } = await supabase
      .from("profiles")
      .update({ discreet_avatar: next } as never)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setValue(prev);
      toast.error("Nu am putut salva. Încearcă din nou.");
      return;
    }
    toast.success(
      next
        ? "Gata — în liste apari cu emoticonul ales, nu cu poza."
        : "Poza ta e din nou vizibilă în liste.",
    );
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-surface/60 p-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-medium">
        <EyeOff className="size-3.5 text-muted-foreground" />
        Persoană discretă
      </p>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Nu vrei ca poza ta să apară în liste? Alege un emoticon care te reprezintă — îl vor vedea
        ceilalți în locul pozei.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(null)}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-[11px]",
            value === null ? "border-primary bg-primary/10 text-primary" : "border-border",
          )}
        >
          Poza mea
        </button>
        {OPTIONS.map((emo) => (
          <button
            key={emo}
            type="button"
            disabled={saving}
            aria-label={`Emoticon ${emo}`}
            onClick={() => void save(emo)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border text-lg",
              value === emo ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            {emo}
          </button>
        ))}
        {saving && <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />}
      </div>
    </div>
  );
}

export default DiscreetAvatarPicker;
