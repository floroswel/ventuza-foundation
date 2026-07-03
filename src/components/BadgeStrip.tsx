import { sortBadges } from "@/lib/badges-registry";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  codes: readonly string[];
  max?: number;
  size?: "xs" | "sm";
  className?: string;
};

/**
 * Renders a compact strip of badges. Data must come from server-side RPC
 * (get_user_badges / get_venue_badges) — never derive client-side.
 * Fiecare badge are tooltip cu motivul acordării și, unde există, condiția de expirare.
 */
export function BadgeStrip({ codes, max = 3, size = "sm", className = "" }: Props) {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith("ro") ? "ro" : "en") as "ro" | "en";
  const badges = sortBadges(codes).slice(0, max);
  if (badges.length === 0) return null;

  const iconSize = size === "xs" ? "size-3" : "size-3.5";
  const pad = size === "xs" ? "p-0.5" : "p-1";

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`flex items-center gap-1 ${className}`}>
        {badges.map((b) => {
          const Icon = b.icon;
          const a11y = `${b.label[lang]} — ${b.criteria}${b.expiry ? ` ${b.expiry}` : ""}`;
          return (
            <Tooltip key={b.code}>
              <TooltipTrigger asChild>
                <span
                  aria-label={a11y}
                  className={`inline-flex items-center justify-center rounded-full bg-black/60 backdrop-blur ${pad}`}
                >
                  <Icon className={`${iconSize} ${b.colorClass}`} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                <div className="font-semibold">{b.label[lang]}</div>
                <div className="text-muted-foreground mt-0.5">{b.criteria}</div>
                {b.expiry && (
                  <div className="text-muted-foreground mt-1 italic">{b.expiry}</div>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
