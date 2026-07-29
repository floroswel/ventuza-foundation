import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium cursor-pointer select-none",
    "transition-[transform,box-shadow,background,color,opacity] duration-200 ease-out",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    // Focus vizibil universal cu contur brand + halou pentru accesibilitate
    "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-[color:oklch(0.72_0.24_320)]",
    "focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_60%,transparent),0_8px_28px_-8px_color-mix(in_oklab,var(--primary)_55%,transparent)]",
    // Pressed feedback comun
    "active:scale-[0.97] active:brightness-95",
    // Disabled comun — gradient dezaturat, fără interacțiune
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 disabled:saturate-50 disabled:shadow-none disabled:active:scale-100",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "text-primary-foreground bg-brand-gradient shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--primary)_55%,transparent)] hover:brightness-110 hover:shadow-[0_14px_36px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)] active:brightness-90",
        hero:
          "text-primary-foreground bg-brand-gradient glow-brand hover:brightness-110 hover:shadow-[0_18px_44px_-12px_color-mix(in_oklab,var(--primary)_75%,transparent)]",
        outline:
          "border border-transparent bg-transparent text-foreground [background:linear-gradient(var(--card),var(--card))_padding-box,var(--gradient-brand)_border-box] hover:[background:linear-gradient(color-mix(in_oklab,var(--primary)_10%,var(--card)),color-mix(in_oklab,var(--primary)_10%,var(--card)))_padding-box,var(--gradient-brand)_border-box]",
        ghost:
          "text-foreground hover:text-primary-foreground hover:bg-brand-gradient hover:shadow-[0_10px_28px_-14px_color-mix(in_oklab,var(--primary)_60%,transparent)]",
        subtle:
          "bg-surface-elevated text-foreground hover:text-primary-foreground hover:bg-brand-gradient",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--destructive)_55%,transparent)] hover:brightness-110 focus-visible:ring-[color:var(--destructive)]",
        link: "text-brand-gradient underline-offset-4 hover:underline active:scale-100",
        secondary:
          "bg-secondary text-secondary-foreground hover:text-primary-foreground hover:bg-brand-gradient",
      },
      size: {
        default: "h-11 px-5 py-2 text-sm",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-14 rounded-2xl px-8 text-base font-semibold",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
