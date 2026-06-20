import { cn } from "@/lib/utils";

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-all active:scale-95",
        active
          ? "border-primary bg-primary/15 text-primary glow-gold"
          : "border-border bg-surface text-foreground hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}
