import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square size-5 rounded-full border border-input bg-surface/60 shadow-sm cursor-pointer",
        "transition-[background,border-color,box-shadow,transform] duration-200 ease-out",
        "hover:border-[color:oklch(0.72_0.24_320)] hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_12%,transparent)]",
        "active:scale-95",
        "outline-none focus-visible:border-[color:oklch(0.72_0.24_320)]",
        "focus-visible:ring-2 focus-visible:ring-[color:oklch(0.72_0.24_320)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_55%,transparent),0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent)]",
        "data-[state=checked]:border-transparent data-[state=checked]:bg-brand-gradient",
        "data-[state=checked]:shadow-[0_6px_18px_-8px_color-mix(in_oklab,var(--primary)_65%,transparent)]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className="block size-2 rounded-full bg-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklab,white_40%,transparent)]" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
