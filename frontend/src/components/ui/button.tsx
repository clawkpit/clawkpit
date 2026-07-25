import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { haptic, type HapticPattern } from "@/lib/haptics";
import { Spinner } from "@/components/ui/spinner";

const buttonVariants = cva(
  [
    "pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium select-none",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "shadow-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90 active:bg-primary/80 active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80 active:shadow-none",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground active:bg-accent/80 active:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:bg-secondary/70 active:shadow-none",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        link: "text-primary underline-offset-4 hover:underline active:opacity-70 !scale-100",
      },
      size: {
        default: "min-h-12 h-12 px-4 py-2",
        sm: "min-h-12 h-12 rounded-md px-3 text-xs",
        lg: "min-h-12 h-12 rounded-md px-8",
        icon: "min-h-12 min-w-12 h-12 w-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows an inline spinner and disables the button while true. */
  loading?: boolean;
  /**
   * Optional haptic feedback on press for meaningful actions.
   * Pass `true` for light, or a specific pattern. Do not use on every control.
   */
  haptic?: boolean | HapticPattern;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      haptic: hapticProp,
      disabled,
      children,
      onClick,
      onPointerDown,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(e);
      if (e.defaultPrevented || isDisabled || !hapticProp) return;
      haptic(hapticProp === true ? "light" : hapticProp);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          loading && "relative [&>svg:not([data-spinner])]:hidden"
        )}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        {...props}
      >
        {loading && <Spinner className="shrink-0 text-[1rem]" label="Loading" />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
