import { sortBadges } from "@/lib/badges-registry";
import { useTranslation } from "react-i18next";

type Props = {
  codes: readonly string[];
  max?: number;
  size?: "xs" | "sm";
  className?: string;
};

/**
 * Renders a compact strip of badges. Data must come from server-side RPC
 * (get_user_badges / get_venue_badges) — never derive client-side.
 */
export function BadgeStrip({ codes, max = 3, size = "sm", className = "" }: Props) {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith("ro") ? "ro" : "en") as "ro" | "en";
  const badges = sortBadges(codes).slice(0, max);
  if (badges.length === 0) return null;

  const iconSize = size === "xs" ? "size-3" : "size-3.5";
  const pad = size === "xs" ? "p-0.5" : "p-1";

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {badges.map((b) => {
        const Icon = b.icon;
        return (
          <span
            key={b.code}
            title={b.label[lang]}
            aria-label={b.label[lang]}
            className={`inline-flex items-center justify-center rounded-full bg-black/60 backdrop-blur ${pad}`}
          >
            <Icon className={`${iconSize} ${b.colorClass}`} />
          </span>
        );
      })}
    </div>
  );
}
