import { useRouter, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  fallback?: string;
  label?: string;
  className?: string;
};

/**
 * Buton "înapoi" reutilizabil.
 * Folosește router.history.back() dacă există istoric, altfel fallback (default /discover).
 * Plasat sticky în partea de sus a paginilor — mereu accesibil cu degetul.
 */
export function BackButton({ fallback = "/discover", label = "Înapoi", className }: Props) {
  const router = useRouter();
  const navigate = useNavigate();

  const onClick = () => {
    const canGoBack =
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      document.referrer !== "";
    if (canGoBack) {
      router.history.back();
    } else {
      navigate({ to: fallback });
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 text-sm font-medium text-foreground/90 backdrop-blur transition hover:bg-muted/60 active:scale-95",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
