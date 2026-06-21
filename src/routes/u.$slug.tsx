import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, Mic, Music, ArrowLeft, Heart, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Chip } from "@/components/Chip";
import { ProfileBadgesRow } from "@/components/ProfileBadgesRow";
import { formatHeight } from "@/lib/discover";

export const Route = createFileRoute("/u/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.slug} · Ventuza` },
      { name: "description", content: `Vezi profilul ${params.slug} pe Ventuza.` },
      { property: "og:title", content: `@${params.slug} · Ventuza` },
      { property: "og:type", content: "profile" },
    ],
  }),
  component: PublicProfilePage,
});

function age(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso); const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

function PublicProfilePage() {
  const { slug } = Route.useParams();
  const [profile, setProfile] = useState<any | null>(null);
  const [signedPhoto, setSignedPhoto] = useState<string | null>(null);
  const [signedVoice, setSignedVoice] = useState<string | null>(null);
  const [signedVideo, setSignedVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("profile_slug", slug)
        .maybeSingle();
      setProfile(data);
      setLoading(false);
      if (data?.photos?.[0]) {
        const { data: s } = await supabase.storage.from("profile-photos").createSignedUrl(data.photos[0], 3600);
        if (s?.signedUrl) setSignedPhoto(s.signedUrl);
      }
      if (data?.voice_prompt_path) {
        const { data: s } = await supabase.storage.from("profile-media").createSignedUrl(data.voice_prompt_path, 3600);
        if (s?.signedUrl) setSignedVoice(s.signedUrl);
      }
      if (data?.video_clip_path) {
        const { data: s } = await supabase.storage.from("profile-media").createSignedUrl(data.video_clip_path, 3600);
        if (s?.signedUrl) setSignedVideo(s.signedUrl);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-xl font-medium">Profil indisponibil</h1>
        <p className="text-sm text-muted-foreground">Link-ul nu mai este valid sau profilul a fost ascuns.</p>
        <Link to="/" className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Acasă</Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background pb-20">
      <section className="relative">
        <div className="aspect-[4/5] w-full overflow-hidden bg-surface">
          {signedPhoto ? (
            <img src={signedPhoto} alt={profile.display_name} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">No photo</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
        <Link
          to="/"
          className="absolute left-4 top-4 inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface/80 backdrop-blur"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
          <h1 className="wordmark text-4xl">
            {profile.display_name}
            {age(profile.birthdate) && <span className="ml-2 text-foreground/80">{age(profile.birthdate)}</span>}
          </h1>
          {profile.verified_at && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary backdrop-blur">
              <BadgeCheck className="size-3" /> Verified
            </span>
          )}
          <div className="mt-3"><ProfileBadgesRow profile={profile} /></div>
        </div>
      </section>

      <div className="space-y-6 px-6 pt-6">
        {signedVideo && (
          <div className="rounded-2xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Video className="size-4 text-primary" /> Clip
            </div>
            <video src={signedVideo} controls playsInline className="w-full rounded-xl bg-black" />
          </div>
        )}

        {signedVoice && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Mic className="size-4 text-primary" /> {profile.voice_prompt_question || "Voice prompt"}
            </div>
            <audio controls src={signedVoice} className="w-full" />
          </div>
        )}

        {profile.anthem && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Music className="size-4 text-primary" /> My anthem
            </div>
            <p className="font-medium">{profile.anthem.title}</p>
            <p className="text-sm text-muted-foreground">{profile.anthem.artist}</p>
            {profile.anthem.url && <a href={profile.anthem.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ascultă</a>}
          </div>
        )}

        {profile.ideal_match && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Heart className="size-4 text-primary" /> Match ideal
            </div>
            <p className="italic text-foreground/85">"{profile.ideal_match}"</p>
          </div>
        )}

        {profile.ask_me_about?.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Ask me about</h2>
            <div className="flex flex-wrap gap-2">{profile.ask_me_about.map((t: string) => <Chip key={t} active>💬 {t}</Chip>)}</div>
          </section>
        )}

        {profile.bio && (
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">About</h2>
            <p className="whitespace-pre-wrap text-foreground/90">{profile.bio}</p>
          </section>
        )}

        {profile.interests?.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Interests</h2>
            <div className="flex flex-wrap gap-2">{profile.interests.map((i: string) => <Chip key={i} active>{i}</Chip>)}</div>
          </section>
        )}

        {profile.tribes?.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Tribes</h2>
            <div className="flex flex-wrap gap-2">{profile.tribes.map((t: string) => <Chip key={t} active>{t}</Chip>)}</div>
          </section>
        )}

        {(profile.height_cm || profile.body_type || profile.job_title) && (
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Stats</h2>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
              {formatHeight(profile.height_cm) && <div><p className="text-[10px] uppercase text-muted-foreground">Height</p><p>{formatHeight(profile.height_cm)}</p></div>}
              {profile.body_type && <div><p className="text-[10px] uppercase text-muted-foreground">Body</p><p>{profile.body_type}</p></div>}
              {profile.job_title && <div><p className="text-[10px] uppercase text-muted-foreground">Job</p><p>{profile.job_title}</p></div>}
              {profile.zodiac && <div><p className="text-[10px] uppercase text-muted-foreground">Zodiac</p><p>{profile.zodiac}</p></div>}
            </div>
          </section>
        )}

        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="block rounded-full bg-primary py-3 text-center text-sm font-medium text-primary-foreground"
        >
          Intră în Ventuza ca să te conectezi cu {profile.display_name}
        </Link>
      </div>
    </main>
  );
}
