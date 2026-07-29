import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm",
      "transition-[background,box-shadow] duration-200 ease-out",
      "outline-none focus-visible:ring-2 focus-visible:ring-[color:oklch(0.72_0.24_320)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_55%,transparent),0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_55%,transparent)]",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50",
      "data-[state=unchecked]:bg-input data-[state=unchecked]:hover:bg-input/80",
      "data-[state=checked]:bg-brand-gradient data-[state=checked]:shadow-[0_6px_18px_-8px_color-mix(in_oklab,var(--primary)_65%,transparent)]",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block size-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
