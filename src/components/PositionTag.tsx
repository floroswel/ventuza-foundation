import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOptionLabel } from "@/lib/i18n/option-labels";
import { useUiLocale } from "@/lib/i18n/locale";

/** Explicații scurte pentru termenii de poziție (RO + EN). */
const POSITION_HINTS: Record<string, { ro: string; en: string }> = {
  Top: { ro: "Rol activ.", en: "Active role." },
  "Vers Top": {
    ro: "Versatil, dar preferă rolul activ.",
    en: "Versatile, but prefers the active role.",
  },
  Versatile: {
    ro: "Versatil — activ sau pasiv, în funcție de moment.",
    en: "Versatile — active or passive, depending on the moment.",
  },
  "Vers Bottom": {
    ro: "Versatil, dar preferă rolul pasiv.",
    en: "Versatile, but prefers the passive role.",
  },
  Bottom: { ro: "Rol pasiv.", en: "Passive role." },
  Side: {
    ro: "Fără penetrare — alte forme de intimitate.",
    en: "No penetration — other forms of intimacy.",
  },
  Oral: { ro: "Doar sex oral.", en: "Oral only." },
  "Not sure": {
    ro: "Încă explorează, fără o preferință fixă.",
    en: "Still exploring, no fixed preference.",
  },
};

export function positionHint(value: string, locale: string): string | null {
  const entry = POSITION_HINTS[value];
  if (!entry) return null;
  return locale === "ro" ? entry.ro : entry.en;
}

/**
 * Eticheta standard pentru poziție (Activ / Pasiv / Vers …).
 * Sursă unică de adevăr pentru stil + traducere, folosită în Descoperă,
 * profil public, profilul propriu și paginile deschise din notificări.
 */
export function PositionTag({
  value,
  size = "md",
  className = "",
  withHint = true,
}: {
  value?: string | null;
  size?: "sm" | "md";
  className?: string;
  withHint?: boolean;
}) {
  const label = useOptionLabel();
  const locale = useUiLocale();
  if (!value) return null;

  const hint = positionHint(value, locale);
  const isSm = size === "sm";

  const text = (
    <span
      className={
        (isSm
          ? "truncate text-[9px] tracking-wider "
          : "text-xs font-semibold tracking-[0.2em] ") + "uppercase text-primary"
      }
    >
      {label(value)}
    </span>
  );

  if (isSm || !withHint || !hint) {
    return (
      <p className={(isSm ? "truncate " : "mt-1 ") + className}>{text}</p>
    );
  }

  return (
    <div className={"mt-1 " + className}>
      <div className="flex items-center gap-1.5">
        {text}
        <Popover>
          <PopoverTrigger
            aria-label={locale === "ro" ? "Ce înseamnă?" : "What does this mean?"}
            className="inline-flex size-4 items-center justify-center rounded-full text-primary/70 transition-colors hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <Info className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-64 text-xs leading-relaxed"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold text-foreground">{label(value)}</p>
            <p className="mt-1 text-muted-foreground">{hint}</p>
          </PopoverContent>
        </Popover>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-white/60">{hint}</p>
    </div>
  );
}

export const positionTagClass =
  "text-xs font-semibold uppercase tracking-[0.2em] text-primary";
