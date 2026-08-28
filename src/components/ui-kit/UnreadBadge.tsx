import { cn } from "@/lib/utils";

export function UnreadBadge({
  count,
  className,
  tone = "primary",
}: {
  count: number;
  className?: string;
  tone?: "primary" | "rose";
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none",
        tone === "primary"
          ? "bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.45)]"
          : "bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.6)]",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
