import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer grid size-5 shrink-0 place-content-center rounded-md border border-input bg-surface/60 shadow-sm cursor-pointer",
      "transition-[background,border-color,box-shadow,transform] duration-200 ease-out",
      "hover:border-[color:oklch(0.72_0.24_320)] hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_12%,transparent)]",
      "active:scale-95",
      "outline-none focus-visible:border-[color:oklch(0.72_0.24_320)]",
      "focus-visible:ring-2 focus-visible:ring-[color:oklch(0.72_0.24_320)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_55%,transparent),0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent)]",
      "data-[state=checked]:border-transparent data-[state=checked]:text-primary-foreground data-[state=checked]:bg-brand-gradient",
      "data-[state=checked]:shadow-[0_6px_18px_-8px_color-mix(in_oklab,var(--primary)_65%,transparent)]",
      "data-[state=indeterminate]:border-transparent data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:bg-brand-gradient",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-current")}>
      <Check className="size-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
