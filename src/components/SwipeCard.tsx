import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { Heart, Star, X, MapPin, Flag } from "lucide-react";
import { ReportBlockDialog } from "@/components/ReportBlockDialog";
import { ageFrom, formatDistance, signPhotos, type DiscoverProfile } from "@/lib/discover";

type Props = {
  profile: DiscoverProfile;
  onDecision: (action: "like" | "pass" | "super") => void;
  stackIndex: number; // 0 = top
};

const SWIPE_THRESHOLD = 110;

export function SwipeCard({ profile, onDecision, stackIndex }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const likeOpacity = useTransform(x, [40, 160], [0, 1]);
  const passOpacity = useTransform(x, [-160, -40], [1, 0]);
  const superOpacity = useTransform(y, [-160, -40], [1, 0]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const path = profile.photos?.[0];
    if (!path) return;
    signPhotos([path]).then((m) => {
      if (!cancelled) setPhotoUrl(m[path] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.id, profile.photos]);

  function handleEnd(_e: any, info: PanInfo) {
    if (info.offset.y < -SWIPE_THRESHOLD && Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      onDecision("super");
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      onDecision("like");
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onDecision("pass");
    } else {
      x.set(0);
      y.set(0);
    }
  }

  const age = ageFrom(profile.birthdate);
  const topPrompt = profile.prompts?.find((p) => p.question && p.answer);
  const isTop = stackIndex === 0;

  return (
    <motion.div
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleEnd}
      style={{ x, y, rotate, zIndex: 10 - stackIndex }}
      initial={{
        scale: 1 - stackIndex * 0.04,
        y: stackIndex * 12,
        opacity: stackIndex > 2 ? 0 : 1,
      }}
      animate={{
        scale: 1 - stackIndex * 0.04,
        y: stackIndex * 12,
        opacity: stackIndex > 2 ? 0 : 1,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="absolute inset-0 cursor-grab overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] active:cursor-grabbing"
    >
      {/* photo */}
      <div className="relative size-full">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={profile.display_name ?? ""}
            className="size-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            No photo
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />

        {isTop && (
          <div
            className="absolute right-3 top-3 z-10"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ReportBlockDialog
              targetUserId={profile.id}
              targetName={profile.display_name ?? undefined}
              trigger={
                <button
                  className="rounded-full bg-background/70 p-2 text-foreground/70 backdrop-blur hover:text-destructive"
                  aria-label="Raportează"
                >
                  <Flag className="size-4" />
                </button>
              }
            />
          </div>
        )}

        {/* like / pass / super overlays */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute right-6 top-8 rounded-2xl border-2 border-primary px-4 py-2 text-lg font-bold uppercase tracking-widest text-primary glow-gold rotate-12"
            >
              Like
            </motion.div>
            <motion.div
              style={{ opacity: passOpacity }}
              className="absolute left-6 top-8 rounded-2xl border-2 border-destructive px-4 py-2 text-lg font-bold uppercase tracking-widest text-destructive -rotate-12"
            >
              Pass
            </motion.div>
            <motion.div
              style={{ opacity: superOpacity }}
              className="absolute left-1/2 top-6 -translate-x-1/2 rounded-2xl border-2 border-primary px-4 py-2 text-lg font-bold uppercase tracking-widest text-primary glow-gold"
            >
              ★ Super
            </motion.div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 p-6 text-foreground">
          <div className="flex items-baseline gap-2">
            <h2 className="wordmark text-3xl font-medium">{profile.display_name}</h2>
            {age && <span className="text-2xl font-light text-foreground/80">{age}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {formatDistance(profile.distance_m)}
            </span>
            {profile.pronouns?.[0] && <span>· {profile.pronouns[0]}</span>}
          </div>
          {topPrompt ? (
            <div className="mt-4 rounded-2xl border border-border/60 bg-background/70 p-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-primary">
                {topPrompt.question}
              </p>
              <p className="mt-1 font-display text-base leading-snug line-clamp-2">
                {topPrompt.answer}
              </p>
            </div>
          ) : profile.interests?.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {profile.interests.slice(0, 3).map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                >
                  {i}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export function SwipeActions({
  onAction,
  disabled,
}: {
  onAction: (a: "like" | "pass" | "super") => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-5">
      <button
        onClick={() => onAction("pass")}
        disabled={disabled}
        aria-label="Pass"
        className="flex size-14 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-all hover:border-destructive hover:text-destructive active:scale-95 disabled:opacity-40"
      >
        <X className="size-6" />
      </button>
      <button
        onClick={() => onAction("super")}
        disabled={disabled}
        aria-label="Super interest"
        className="flex size-12 items-center justify-center rounded-full border border-primary/50 bg-surface text-primary transition-all hover:bg-primary/15 active:scale-95 disabled:opacity-40"
      >
        <Star className="size-5" />
      </button>
      <button
        onClick={() => onAction("like")}
        disabled={disabled}
        aria-label="Like"
        className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground glow-gold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
      >
        <Heart className="size-6 fill-current" />
      </button>
    </div>
  );
}
