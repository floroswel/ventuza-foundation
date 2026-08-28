import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <BadgeCheck
      aria-label="Cont verificat"
      className={cn(
        "shrink-0 text-[var(--verified)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]",
        size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-3.5",
        className,
      )}
    />
  );
}
