import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicator unic de prezență pentru toată aplicația: punct verde = online,
 * avion verde = călător (plecat >50 km de orașul de bază).
 */
export function OnlineIndicator({
  online,
  traveler = false,
  size = "md",
  ring = false,
  className,
}: {
  online: boolean;
  traveler?: boolean;
  size?: "sm" | "md" | "lg";
  ring?: boolean;
  className?: string;
}) {
  if (!online && !traveler) return null;
  const box = size === "sm" ? "size-2.5" : size === "lg" ? "size-4" : "size-3";
  if (traveler) {
    return (
      <span
        aria-label="Călător"
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-emerald-500 text-white",
          size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-4",
          ring && "ring-2 ring-background",
          className,
        )}
      >
        <Plane className={size === "lg" ? "size-3" : "size-2"} />
      </span>
    );
  }
  return (
    <span
      aria-label="Online"
      className={cn(
        "inline-block rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153)]",
        box,
        ring && "ring-2 ring-background",
        className,
      )}
    />
  );
}
