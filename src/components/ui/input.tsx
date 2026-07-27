import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[52px] w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-2 text-[15px] text-foreground transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 hover:border-white/[0.14] hover:bg-white/[0.05] focus-visible:border-primary/55 focus-visible:bg-white/[0.05] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_oklch(0.85_0.22_145/0.1),0_8px_24px_rgba(0,0,0,0.24)] disabled:cursor-not-allowed disabled:opacity-50",
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
