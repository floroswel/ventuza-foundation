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

export type BadgeDef = {
  code: BadgeCode;
  target: BadgeTarget;
  label: { ro: string; en: string };
  icon: LucideIcon;
  colorClass: string;
  priority: number;
  criteria: string;
  /** Când/în ce condiții expiră badge-ul. `null` = permanent. */
  expiry: string | null;
};


export const BADGES: Record<BadgeCode, BadgeDef> = {
  verified: {
    code: "verified",
    target: "user",
    label: { ro: "Verificat 18+", en: "Verified 18+" },
    icon: BadgeCheck,
    colorClass: "text-rose-500",
    priority: 100,
    criteria: "Verificare identitate Didit completă (18+).",
    expiry: null,
  },
  founder: {
    code: "founder",
    target: "user",
    label: { ro: "Pionier", en: "Founder" },
    icon: Sparkles,
    colorClass: "text-amber-400",
    priority: 90,
    criteria: "Cont creat înainte de 1 august 2026.",
    expiry: null,
  },
  streak_7: {
    code: "streak_7",
    target: "user",
    label: { ro: "Activ 7 zile", en: "7-day streak" },
    icon: Flame,
    colorClass: "text-orange-500",
    priority: 60,
    criteria: "Activitate în 7 zile consecutive.",
    expiry: "Dispare după 48h fără activitate.",
  },
  matcher: {
    code: "matcher",
    target: "user",
    label: { ro: "Popular", en: "Popular" },
    icon: Heart,
    colorClass: "text-fuchsia-500",
    priority: 50,
    criteria: "Cel puțin 25 de match-uri reciproce.",
    expiry: null,
  },
  explorer: {
    code: "explorer",
    target: "user",
    label: { ro: "Explorator", en: "Explorer" },
    icon: Compass,
    colorClass: "text-teal-400",
    priority: 40,
    criteria: "Activitate în cel puțin 5 orașe diferite.",
    expiry: null,
  },
  partner_premium: {
    code: "partner_premium",
    target: "venue",
    label: { ro: "Premium", en: "Premium" },
    icon: Crown,
    colorClass: "text-amber-500",
    priority: 100,
    criteria: "Partener cu plan Premium/Pro activ.",
    expiry: "Dispare la expirarea sau downgrade-ul planului.",
  },
  partner_boost: {
    code: "partner_boost",
    target: "venue",
    label: { ro: "Boost", en: "Boost" },
    icon: Rocket,
    colorClass: "text-rose-500",
    priority: 95,
    criteria: "Boost activ pentru vizibilitate crescută.",
    expiry: "Dispare la finalul ferestrei de boost plătite.",
  },
  official: {
    code: "official",
    target: "venue",
    label: { ro: "Oficial", en: "Official" },
    icon: ShieldCheck,
    colorClass: "text-blue-500",
    priority: 90,
    criteria: "Local oficial verificat de echipa Ventuza.",
    expiry: null,
  },
};


export function sortBadges(codes: readonly string[]): BadgeDef[] {
  return codes
    .map((c) => BADGES[c as BadgeCode])
    .filter((b): b is BadgeDef => Boolean(b))
    .sort((a, b) => b.priority - a.priority);
}
