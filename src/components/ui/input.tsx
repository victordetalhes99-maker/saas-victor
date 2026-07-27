import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[58px] w-full rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,oklch(1_0_0/0.047),oklch(1_0_0/0.025))] px-[18px] py-2 text-base text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_10px_30px_rgba(0,0,0,0.18)] transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 hover:border-white/[0.16] focus-visible:border-primary/70 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_oklch(0.85_0.22_145/0.08),0_0_25px_oklch(0.85_0.22_145/0.1),inset_0_1px_0_rgba(255,255,255,0.05)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
