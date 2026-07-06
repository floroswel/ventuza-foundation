import { useState } from "react";
import { sortBadges, BADGES, type BadgeCode, type BadgeDef } from "@/lib/badges-registry";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

type Props = {
  codes: readonly string[];
  max?: number;
  size?: "xs" | "sm";
  className?: string;
  loading?: boolean;
  error?: boolean;
  skeletonCount?: number;
};

/**
 * Renders a compact strip of badges. Data must come from server-side RPC
 * (get_user_badges / get_venue_badges) — never derive client-side.
 * Hover = tooltip scurt. Click/tap = drawer cu motivul complet + condiție expirare.
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
  const [openCode, setOpenCode] = useState<BadgeCode | null>(null);

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

  const activeBadge = openCode ? BADGES[openCode] : null;

  const detailsHint = lang === "ro" ? "Apasă pentru detalii" : "Tap for details";

  return (
    <>
      {/* disableHoverableContent = tooltip-ul nu prinde pointer, tap-ul rămâne al butonului. */}
      <TooltipProvider delayDuration={200} disableHoverableContent>
        <div className={`flex items-center gap-1 ${className}`}>
          {badges.map((b) => {
            const Icon = b.icon;
            const labelText = b.label[lang];
            const criteriaText = b.criteria[lang];
            const expiryText = b.expiry ? b.expiry[lang] : null;
            // aria-label bogat: nume + motiv + expirare + hint de interacțiune,
            // ca utilizatorii de screen reader / voice control să aibă contextul complet.
            const a11y = [
              labelText,
              criteriaText,
              expiryText,
              detailsHint,
            ]
              .filter(Boolean)
              .join(" — ");
            return (
              <Tooltip key={b.code}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={a11y}
                    aria-haspopup="dialog"
                    aria-expanded={openCode === b.code}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenCode(b.code);
                    }}
                    className={`relative inline-flex items-center justify-center rounded-full bg-black/60 backdrop-blur ${pad} transition-transform active:scale-90 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1 focus-visible:ring-offset-black touch-manipulation overflow-hidden ${b.effect === "glow" ? `badge-effect-glow ${b.colorClass}` : ""} ${b.effect === "pulse" ? "badge-effect-pulse" : ""}`}
                  >
                    <Icon className={`${iconSize} ${b.colorClass} relative z-10`} aria-hidden="true" />
                    {b.effect === "shimmer" && (
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 badge-effect-shimmer" />
                    )}
                  </button>
                </TooltipTrigger>
                {/* Tooltip vizual pentru hover + focus tastatură (Radix îl deschide și la Tab). */}
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  <div className="font-semibold">{labelText}</div>
                  <div className="text-muted-foreground mt-0.5">{detailsHint}</div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>


      <BadgeDetailDrawer
        badge={activeBadge}
        lang={lang}
        onOpenChange={(open) => !open && setOpenCode(null)}
      />
    </>
  );
}

function BadgeDetailDrawer({
  badge,
  lang,
  onOpenChange,
}: {
  badge: BadgeDef | null;
  lang: "ro" | "en";
  onOpenChange: (open: boolean) => void;
}) {
  const open = badge !== null;
  const Icon = badge?.icon;

  const t = (ro: string, en: string) => (lang === "ro" ? ro : en);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader className="text-center">
            {Icon && badge && (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Icon className={`h-7 w-7 ${badge.colorClass}`} />
              </div>
            )}
            <DrawerTitle className="text-xl">{badge?.label[lang]}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("Detalii badge", "Badge details")}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-6 pb-2 space-y-4 text-sm">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("Cum se obține", "How to earn")}
              </h3>
              <p className="text-foreground">{badge?.criteria[lang]}</p>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("Condiție de expirare", "Expiry condition")}
              </h3>
              <p className="text-foreground">
                {badge?.expiry ? badge.expiry[lang] : t("Permanent — nu expiră.", "Permanent — never expires.")}
              </p>
            </section>

            <section className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t(
                "Toate badge-urile sunt calculate automat pe server. Nu pot fi cumpărate sau acordate manual.",
                "All badges are computed automatically on the server. They cannot be purchased or granted manually.",
              )}
            </section>
          </div>

          <DrawerFooter className="flex-row gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/legal/badges" onClick={() => onOpenChange(false)}>
                {t("Vezi toate badge-urile", "View all badges")}
              </Link>
            </Button>
            <DrawerClose asChild>
              <Button className="flex-1">{t("Închide", "Close")}</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
