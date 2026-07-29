import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[72px] w-full rounded-xl border border-input bg-surface/60 px-3.5 py-2.5 text-base text-foreground shadow-sm",
          "transition-[border-color,box-shadow,background-color] duration-200 ease-out",
          "placeholder:text-muted-foreground",
          "hover:border-primary/40 hover:bg-surface/80",
          "outline-none focus-visible:border-[color:oklch(0.72_0.24_320)] focus-visible:bg-surface",
          "focus-visible:ring-2 focus-visible:ring-[color:oklch(0.72_0.24_320)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_55%,transparent),0_10px_28px_-12px_color-mix(in_oklab,var(--primary)_50%,transparent)]",
          "aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-[color:var(--destructive)]",
          "aria-invalid:focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--destructive)_55%,transparent),0_10px_28px_-12px_color-mix(in_oklab,var(--destructive)_50%,transparent)]",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
