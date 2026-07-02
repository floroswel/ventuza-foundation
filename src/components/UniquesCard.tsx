import { useEffect, useState } from "react";
import { Lock, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { clearPin, hasPin, setPin } from "@/lib/pin-lock";
import { PanicToolsCard } from "./PanicToolsCard";

const LANGS = [
  { value: "ro", label: "Română" },
  { value: "en", label: "English" },
  { value: "hu", label: "Magyar" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];

type Prefs = { pronouns: string; friends_only_mode: boolean; preferred_language: string };

/** Card grupând diferențiatorii unici Ventuza: pronume, mod prieteni, traducere, PIN, mod discret. */
export function UniquesCard() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>({
    pronouns: "",
    friends_only_mode: false,
    preferred_language: "ro",
  });
  const [saving, setSaving] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [pinDraft, setPinDraft] = useState("");

  useEffect(() => {
    if (!user) return;
    setPinSet(hasPin());
    supabase
      .from("profiles")
      .select("pronouns_custom, friends_only_mode, preferred_language")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPrefs({
          pronouns: data.pronouns_custom ?? "",
          friends_only_mode: !!data.friends_only_mode,
          preferred_language: data.preferred_language ?? "ro",
        });
      });
  }, [user]);

  async function save(next: Partial<Prefs>) {
    if (!user) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        pronouns_custom: merged.pronouns,
        friends_only_mode: merged.friends_only_mode,
        preferred_language: merged.preferred_language,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
  }

  async function applyPin() {
    try {
      await setPin(pinDraft);
      setPinSet(true);
      setPinDraft("");
      window.dispatchEvent(new Event("vz:pin-changed"));
      toast.success("PIN activat. Aplicația se va bloca la următoarea deschidere.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function removePin() {
    clearPin();
    setPinSet(false);
    window.dispatchEvent(new Event("vz:pin-changed"));
    toast.success("PIN dezactivat.");
  }

  return (
    <>
      <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-surface to-surface p-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="size-4 text-primary" /> Identitate & traducere
          {saving && <Loader2 className="ml-1 size-3 animate-spin" />}
        </h2>

        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Pronume (afișat pe profil)</label>
            <input
              value={prefs.pronouns}
              onChange={(e) => setPrefs({ ...prefs, pronouns: e.target.value })}
              onBlur={() => save({ pronouns: prefs.pronouns.trim().slice(0, 30) })}
              placeholder="ex: el/ei, ea/ei, they/them"
              maxLength={30}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Limbă preferată (pentru AI Translator în chat)
            </label>
            <select
              value={prefs.preferred_language}
              onChange={(e) => save({ preferred_language: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="size-3.5 text-primary" /> Mod „doar prieteni"
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Profilul tău apare doar pentru networking/prietenii — fără context dating/NSFW.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.friends_only_mode}
              onChange={(e) => save({ friends_only_mode: e.target.checked })}
              className="mt-1 size-4 accent-primary"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Lock className="size-4" /> Blocare cu PIN
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Aplicația cere PIN la fiecare deschidere. PIN-ul rămâne pe acest dispozitiv.
        </p>

        {!pinSet ? (
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="min. 4 cifre"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={applyPin}
              disabled={pinDraft.length < 4}
              className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Activează
            </button>
          </div>
        ) : (
          <button
            onClick={removePin}
            className="mt-3 w-full rounded-full border border-border bg-background py-2 text-xs hover:border-destructive hover:text-destructive"
          >
            Dezactivează PIN-ul
          </button>
        )}
      </section>

      <PanicToolsCard />
    </>
  );
}
