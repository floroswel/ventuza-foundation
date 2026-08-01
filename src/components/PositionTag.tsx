import { useOptionLabel } from "@/lib/i18n/option-labels";

/**
 * Eticheta standard pentru poziție (Activ / Pasiv / Vers …).
 * Sursă unică de adevăr pentru stil + traducere, folosită în Descoperă,
 * profil public, profilul propriu și paginile deschise din notificări.
 */
export function PositionTag({
  value,
  size = "md",
  className = "",
}: {
  value?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const label = useOptionLabel();
  if (!value) return null;
  return (
    <p
      className={
        (size === "sm"
          ? "truncate text-[9px] tracking-wider "
          : "mt-1 text-xs font-semibold tracking-[0.2em] ") +
        "uppercase text-primary " +
        className
      }
    >
      {label(value)}
    </p>
  );
}

export const positionTagClass =
  "text-xs font-semibold uppercase tracking-[0.2em] text-primary";
