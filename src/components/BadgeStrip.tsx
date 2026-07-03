import { sortBadges } from "@/lib/badges-registry";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  codes: readonly string[];
  max?: number;
  size?: "xs" | "sm";
  className?: string;
  /**
   * When true, renders skeleton pills instead of real badges. Keeps the
   * layout stable while server-side batch fetches are in-flight so cards
   * don't visibly jump when badges land a beat later than the profile list.
   */
  loading?: boolean;
  /**
   * When true, the batch fetch failed. Badges are non-critical UI (they add
   * signal, they don't gate access), so we render nothing rather than an
   * error state — matches the "fail silent" behavior the callers already used.
   * The prop exists so parents can pass their state without extra conditionals.
   */
  error?: boolean;
  /**
   * Number of skeleton pills to render while `loading`. Defaults to `max`.
   */
  skeletonCount?: number;
};

/**
 * Renders a compact strip of badges. Data must come from server-side RPC
 * (get_user_badges / get_venue_badges) — never derive client-side.
 * Fiecare badge are tooltip cu motivul acordării și, unde există, condiția de expirare.
 */
export function BadgeStrip({
  codes,
  max = 3,
  size = "sm",
  className = "",
  loading = false,
  error = false,
  skeletonCount,
}: Props) {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith("ro") ? "ro" : "en") as "ro" | "en";

  const iconSize = size === "xs" ? "size-3" : "size-3.5";
  const pad = size === "xs" ? "p-0.5" : "p-1";
  const pillSize = size === "xs" ? "h-4 w-4" : "h-5 w-5";

  if (error) return null;

  if (loading) {
    const n = Math.max(1, Math.min(max, skeletonCount ?? max));
    return (
      <div
        className={`flex items-center gap-1 ${className}`}
        role="status"
        aria-label="Se încarcă badge-urile"
        aria-busy="true"
      >
        {Array.from({ length: n }).map((_, i) => (
          <span
            key={i}
            className={`inline-block rounded-full bg-black/40 backdrop-blur animate-pulse ${pillSize}`}
          />
        ))}
      </div>
    );
  }

  const badges = sortBadges(codes).slice(0, max);
  if (badges.length === 0) return null;

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
