import {
  BadgeCheck,
  Sparkles,
  Flame,
  Heart,
  Compass,
  Crown,
  Rocket,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type BadgeCode =
  | "verified"
  | "founder"
  | "streak_7"
  | "matcher"
  | "explorer"
  | "partner_premium"
  | "partner_boost"
  | "official";

export type BadgeTarget = "user" | "venue" | "event";

export type BadgeLang = "ro" | "en";
export type LocalizedText = { ro: string; en: string };

export type BadgeDef = {
  code: BadgeCode;
  target: BadgeTarget;
  label: LocalizedText;
  icon: LucideIcon;
  colorClass: string;
  priority: number;
  /** Motivul pentru care se acordă badge-ul, bilingv. */
  criteria: LocalizedText;
  /** Când/în ce condiții expiră. `null` = permanent. */
  expiry: LocalizedText | null;
};


export const BADGES: Record<BadgeCode, BadgeDef> = {
  verified: {
    code: "verified",
    target: "user",
    label: { ro: "Verificat 18+", en: "Verified 18+" },
    icon: BadgeCheck,
    colorClass: "text-rose-500",
    priority: 100,
    criteria: {
      ro: "Verificare identitate internă completă (liveness + moderator, 18+).",
      en: "Completed internal identity verification (liveness + moderator, 18+).",
    },
    expiry: null,
  },
  founder: {
    code: "founder",
    target: "user",
    label: { ro: "Pionier", en: "Founder" },
    icon: Sparkles,
    colorClass: "text-amber-400",
    priority: 90,
    criteria: {
      ro: "Cont creat înainte de 1 august 2026.",
      en: "Account created before August 1, 2026.",
    },
    expiry: null,
  },
  streak_7: {
    code: "streak_7",
    target: "user",
    label: { ro: "Activ 7 zile", en: "7-day streak" },
    icon: Flame,
    colorClass: "text-orange-500",
    priority: 60,
    criteria: {
      ro: "Activitate în 7 zile consecutive.",
      en: "Active for 7 consecutive days.",
    },
    expiry: {
      ro: "Dispare după 48h fără activitate.",
      en: "Disappears after 48h of inactivity.",
    },
  },
  matcher: {
    code: "matcher",
    target: "user",
    label: { ro: "Popular", en: "Popular" },
    icon: Heart,
    colorClass: "text-fuchsia-500",
    priority: 50,
    criteria: {
      ro: "Cel puțin 25 de match-uri reciproce.",
      en: "At least 25 mutual matches.",
    },
    expiry: null,
  },
  explorer: {
    code: "explorer",
    target: "user",
    label: { ro: "Explorator", en: "Explorer" },
    icon: Compass,
    colorClass: "text-teal-400",
    priority: 40,
    criteria: {
      ro: "Activitate în cel puțin 5 orașe diferite.",
      en: "Activity in at least 5 different cities.",
    },
    expiry: null,
  },
  partner_premium: {
    code: "partner_premium",
    target: "venue",
    label: { ro: "Premium", en: "Premium" },
    icon: Crown,
    colorClass: "text-amber-500",
    priority: 100,
    criteria: {
      ro: "Partener cu plan Premium/Pro activ.",
      en: "Partner with an active Premium/Pro plan.",
    },
    expiry: {
      ro: "Dispare la expirarea sau downgrade-ul planului.",
      en: "Disappears when the plan expires or is downgraded.",
    },
  },
  partner_boost: {
    code: "partner_boost",
    target: "venue",
    label: { ro: "Boost", en: "Boost" },
    icon: Rocket,
    colorClass: "text-rose-500",
    priority: 95,
    criteria: {
      ro: "Boost activ pentru vizibilitate crescută.",
      en: "Active boost for increased visibility.",
    },
    expiry: {
      ro: "Dispare la finalul ferestrei de boost plătite.",
      en: "Disappears at the end of the paid boost window.",
    },
  },
  official: {
    code: "official",
    target: "venue",
    label: { ro: "Oficial", en: "Official" },
    icon: ShieldCheck,
    colorClass: "text-blue-500",
    priority: 90,
    criteria: {
      ro: "Local oficial verificat de echipa Ventuza.",
      en: "Official venue verified by the Ventuza team.",
    },
    expiry: null,
  },
};


export function sortBadges(codes: readonly string[]): BadgeDef[] {
  return codes
    .map((c) => BADGES[c as BadgeCode])
    .filter((b): b is BadgeDef => Boolean(b))
    .sort((a, b) => b.priority - a.priority);
}
