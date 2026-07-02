import { useRef, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Camera, Plane, Rocket, ShieldAlert } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { verifySelfie } from "@/lib/verification.functions";

type Props = {
  userId: string;
  mainPhotoPath: string | null;
  verificationStatus: string;
  travelCity: string | null;
  travelUntil: string | null;
  boostUntil: string | null;
  onUpdate: () => void;
};

export function ProfilePremiumPanel(props: Props) {
  return (
    <div className="space-y-4">
      <VerificationCard {...props} />
      <TravelCard {...props} />
      <BoostCard {...props} />
    </div>
  );
}

function VerificationCard({ userId, mainPhotoPath, verificationStatus, onUpdate }: Props) {
  const verify = useServerFn(verifySelfie);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    if (!mainPhotoPath) {
      toast.error("Adaugă întâi o poză principală.");
      return;
    }
    setLoading(true);
    try {
      // upload selfie
      const path = `${userId}/selfie-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const [{ data: sa }, { data: sb }] = await Promise.all([
        supabase.storage.from("profile-photos").createSignedUrl(path, 600),
        supabase.storage.from("profile-photos").createSignedUrl(mainPhotoPath, 600),
      ]);
      if (!sa?.signedUrl || !sb?.signedUrl) throw new Error("Nu am putut accesa pozele.");

      await supabase
        .from("profiles")
        .update({
          verification_selfie_path: path,
          verification_status: "pending",
        })
        .eq("id", userId);

      const res = await verify({ data: { selfieUrl: sa.signedUrl, mainPhotoUrl: sb.signedUrl } });
      if (res.verified) toast.success("Verificat ✓ — ai badge-ul oficial.");
      else toast.error(`Verificare eșuată: ${res.reason}`);
      onUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verificare eșuată");
    } finally {
      setLoading(false);
    }
  }

  const verified = verificationStatus === "verified";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${verified ? "bg-primary/15 text-primary" : "bg-surface-elevated text-muted-foreground"}`}
        >
          {verified ? <BadgeCheck className="size-5" /> : <ShieldAlert className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Verificare selfie</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {verified
              ? "Profilul tău e verificat. Apari mai sus în Discover."
              : verificationStatus === "pending"
                ? "În verificare…"
                : verificationStatus === "rejected"
                  ? "Verificarea anterioară a fost respinsă. Mai încearcă."
                  : "Fă un selfie cu degetul mare ridicat. AI-ul compară cu poza ta principală."}
          </p>
          {!verified && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground glow-gold disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Camera className="size-3" />
                )}
                {loading ? "Verific…" : "Fă selfie de verificare"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TravelCard({ userId, travelCity, travelUntil, onUpdate }: Props) {
  const [city, setCity] = useState(travelCity ?? "");
  const [until, setUntil] = useState(travelUntil ? travelUntil.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const active = !!travelCity && (!travelUntil || new Date(travelUntil) > new Date());

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          travel_city: city.trim() || null,
          travel_until: until ? new Date(until).toISOString() : null,
        })
        .eq("id", userId);
      if (error) throw error;
      toast.success(city ? `Travel mode activ în ${city}` : "Travel mode dezactivat");
      onUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setCity("");
    setUntil("");
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ travel_city: null, travel_until: null })
      .eq("id", userId);
    setSaving(false);
    toast.success("Travel mode dezactivat");
    onUpdate();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary/15 text-primary" : "bg-surface-elevated text-muted-foreground"}`}
        >
          <Plane className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Travel mode</p>
          <p className="text-xs text-muted-foreground">
            {active
              ? `În ${travelCity}${travelUntil ? ` până la ${new Date(travelUntil).toLocaleDateString()}` : ""}`
              : "Spune-le altora unde mergi"}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Oraș (ex: Berlin)"
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          type="date"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Salvez…" : active ? "Actualizează" : "Activează"}
        </button>
        {active && (
          <button
            onClick={clear}
            disabled={saving}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Oprește
          </button>
        )}
      </div>
    </div>
  );
}

function BoostCard({ userId, boostUntil, onUpdate }: Props) {
  const active = boostUntil && new Date(boostUntil) > new Date();
  const [busy, setBusy] = useState(false);
  const minutesLeft = active
    ? Math.max(0, Math.round((new Date(boostUntil!).getTime() - Date.now()) / 60000))
    : 0;

  async function start() {
    setBusy(true);
    const until = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min boost
    const { error } = await supabase
      .from("profiles")
      .update({ boost_until: until })
      .eq("id", userId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Boost activat 30 min ✨");
      onUpdate();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary/15 text-primary glow-gold" : "bg-surface-elevated text-muted-foreground"}`}
        >
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Boost</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {active
              ? `Activ încă ${minutesLeft} min — apari primul în Discover.`
              : "30 min de prioritate maximă în Discover."}
          </p>
          {!active && (
            <button
              onClick={start}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground glow-gold disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Rocket className="size-3" />}
              Boost acum
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
