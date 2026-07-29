import {
  BadgeCheck,
  Sparkles,
  Flame,
  Heart,
  Compass,
  Crown,
  Rocket,
  ShieldCheck,
  Wine,
  Calendar,
  Rainbow,
  Mic,
  Shield,
  Bug,
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
  | "official"
  // Manual admin-granted:
  | "founder_suzeta"
  | "ngo_partner"
  | "bar_verified"
  | "event_organizer"
  | "ally"
  | "press"
  | "moderator_public"
  | "beta_tester";

export type BadgeTarget = "user" | "venue" | "event";

export type BadgeLang = "ro" | "en";
export type LocalizedText = { ro: string; en: string };

export type BadgeEffect = "shimmer" | "glow" | "pulse" | null;

export type BadgeDef = {
  code: BadgeCode;
  target: BadgeTarget;
  label: LocalizedText;
  icon: LucideIcon;
  colorClass: string;
  priority: number;
  criteria: LocalizedText;
  expiry: LocalizedText | null;
  effect?: BadgeEffect;
  isManual?: boolean;
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
      ro: "Verificare vârstă (18+) confirmată prin Didit (procesator extern, age estimation).",
      en: "Age verification (18+) confirmed via Didit (external processor, age estimation).",
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
      ro: "Local oficial verificat de echipa Suzeta.",
      en: "Official venue verified by the Suzeta team.",
    },
    expiry: null,
  },
  founder_suzeta: {
    code: "founder_suzeta", target: "user", isManual: true, effect: "shimmer",
    label: { ro: "Fondator Suzeta", en: "Suzeta Founder" },
    icon: Crown, colorClass: "text-amber-400", priority: 200,
    criteria: { ro: "Badge onorific acordat manual fondatorilor și primilor contributori.",
                en: "Honorary badge granted manually to founders and early contributors." },
    expiry: null,
  },
  ngo_partner: {
    code: "ngo_partner", target: "user", isManual: true, effect: "glow",
    label: { ro: "Partener ONG", en: "NGO Partner" },
    icon: Heart, colorClass: "text-emerald-500", priority: 150,
    criteria: { ro: "Reprezentant verificat al unui ONG partener (ACCEPT, ARAS etc.).",
                en: "Verified representative of a partner NGO." },
    expiry: null,
  },
  bar_verified: {
    code: "bar_verified", target: "user", isManual: true, effect: "shimmer",
    label: { ro: "Local verificat", en: "Verified Venue" },
    icon: Wine, colorClass: "text-blue-500", priority: 140,
    criteria: { ro: "Reprezentant verificat al unui local partener Suzeta.",
                en: "Verified representative of a Suzeta partner venue." },
    expiry: null,
  },
  event_organizer: {
    code: "event_organizer", target: "user", isManual: true, effect: null,
    label: { ro: "Organizator evenimente", en: "Event Organizer" },
    icon: Calendar, colorClass: "text-fuchsia-500", priority: 130,
    criteria: { ro: "Organizator verificat de evenimente comunitare.",
                en: "Verified community event organizer." },
    expiry: { ro: "Poate fi acordat cu expirare de admin.", en: "May be granted with expiry by admin." },
  },
  ally: {
    code: "ally", target: "user", isManual: true, effect: "pulse",
    label: { ro: "Aliat comunitate", en: "Community Ally" },
    icon: Rainbow, colorClass: "text-pink-400", priority: 110,
    criteria: { ro: "Aliat verificat al comunității LGBTQ+.",
                en: "Verified LGBTQ+ community ally." },
    expiry: null,
  },
  press: {
    code: "press", target: "user", isManual: true, effect: null,
    label: { ro: "Presă / Media", en: "Press / Media" },
    icon: Mic, colorClass: "text-yellow-500", priority: 120,
    criteria: { ro: "Reprezentant media verificat.",
                en: "Verified press / media representative." },
    expiry: { ro: "Poate fi acordat cu expirare.", en: "May be granted with expiry." },
  },
  moderator_public: {
    code: "moderator_public", target: "user", isManual: true, effect: "glow",
    label: { ro: "Moderator", en: "Moderator" },
    icon: Shield, colorClass: "text-blue-600", priority: 180,
    criteria: { ro: "Membru al echipei de moderare Suzeta.",
                en: "Member of the Suzeta moderation team." },
    expiry: null,
  },
  beta_tester: {
    code: "beta_tester", target: "user", isManual: true, effect: null,
    label: { ro: "Beta Tester", en: "Beta Tester" },
    icon: Bug, colorClass: "text-lime-500", priority: 80,
    criteria: { ro: "A contribuit la testarea versiunilor beta.",
                en: "Contributed to beta testing." },
    expiry: null,
  },
};


export function sortBadges(codes: readonly string[]): BadgeDef[] {
  return codes
    .map((c) => BADGES[c as BadgeCode])
    .filter((b): b is BadgeDef => Boolean(b))
    .sort((a, b) => b.priority - a.priority);
}
