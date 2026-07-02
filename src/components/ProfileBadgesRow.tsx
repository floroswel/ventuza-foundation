import { useMemo } from "react";
import { BadgeCheck, Crown, Shield, Sparkles, Star, Trophy, Flame } from "lucide-react";

type ProfileLike = {
  created_at?: string | null;
  verified_at?: string | null;
  photos?: string[] | null;
  bio?: string | null;
  prompts?: any[] | null;
  interests?: string[] | null;
  tribes?: string[] | null;
  vaccinations?: string[] | null;
  safety_practices?: string[] | null;
  voice_prompt_path?: string | null;
  video_clip_path?: string | null;
  height_cm?: number | null;
  body_type?: string | null;
};

// Cutoff for "Founder" badge — first 10k users
const FOUNDER_CUTOFF = new Date("2026-09-01").getTime();

export function ProfileBadgesRow({ profile }: { profile: ProfileLike }) {
  const badges = useMemo(() => {
    const out: Array<{ key: string; label: string; icon: any; tone: string }> = [];

    if (profile.created_at && new Date(profile.created_at).getTime() < FOUNDER_CUTOFF) {
      out.push({ key: "founder", label: "Founder", icon: Crown, tone: "gold" });
    }
    if (profile.verified_at) {
      out.push({ key: "verified", label: "Verified", icon: BadgeCheck, tone: "primary" });
    }
    if ((profile.vaccinations?.length ?? 0) >= 2 || (profile.safety_practices?.length ?? 0) >= 3) {
      out.push({ key: "safe", label: "Safe play", icon: Shield, tone: "emerald" });
    }
    if (profile.voice_prompt_path || profile.video_clip_path) {
      out.push({ key: "av", label: "A/V", icon: Sparkles, tone: "violet" });
    }

    const completeness =
      (profile.photos?.length ?? 0) >= 4 &&
      !!profile.bio &&
      profile.bio.length > 40 &&
      (profile.interests?.length ?? 0) >= 3 &&
      (profile.tribes?.length ?? 0) > 0 &&
      !!(profile.height_cm || profile.body_type) &&
      profile.prompts?.some((p: any) => p?.answer?.trim());
    if (completeness)
      out.push({ key: "complete", label: "Top profil", icon: Trophy, tone: "amber" });

    if ((profile.photos?.length ?? 0) >= 6) {
      out.push({ key: "gallery", label: "Gallery", icon: Star, tone: "rose" });
    }
    if ((profile.interests?.length ?? 0) + (profile.tribes?.length ?? 0) >= 8) {
      out.push({ key: "vibes", label: "Multi-vibe", icon: Flame, tone: "orange" });
    }

    return out;
  }, [profile]);

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => {
        const Icon = b.icon;
        const cls =
          b.tone === "gold"
            ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
            : b.tone === "primary"
              ? "border-primary/40 bg-primary/10 text-primary"
              : b.tone === "emerald"
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : b.tone === "violet"
                  ? "border-violet-400/40 bg-violet-400/10 text-violet-300"
                  : b.tone === "amber"
                    ? "border-amber-300/40 bg-amber-300/10 text-amber-300"
                    : b.tone === "rose"
                      ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
                      : "border-orange-400/40 bg-orange-400/10 text-orange-300";
        return (
          <span
            key={b.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${cls}`}
          >
            <Icon className="size-3" /> {b.label}
          </span>
        );
      })}
    </div>
  );
}
