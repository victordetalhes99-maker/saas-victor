"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[80] bg-black/[0.66] backdrop-blur-[8px] duration-200",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

// Drawer lateral do design system global: mesma superfície e sombra dos
// modais, largura entre 480-640px no desktop, tela cheia no mobile, com
// cabeçalho e rodapé fixos e conteúdo rolável entre eles (o consumo desse
// scroll fica por conta de quem usa <SheetHeader>/<SheetFooter> como
// irmãos fixos e o restante do conteúdo dentro de uma área com overflow).
const sheetVariants = cva(
  cn(
    "fixed z-[81] flex flex-col gap-0 border border-white/[0.08] bg-[oklch(0.13_0.012_255)] p-0",
    "shadow-[0_32px_80px_rgba(0,0,0,0.55),0_8px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]",
    "duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:duration-150",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "motion-reduce:transition-none motion-reduce:animate-none",
  ),
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 max-h-[88vh] rounded-b-[24px] border-t-0 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[24px] border-b-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-full max-w-[560px] rounded-r-[24px] border-l-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-[560px]",
        right:
          "inset-y-0 right-0 h-full w-full max-w-[560px] rounded-l-[24px] border-r-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[560px]",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      <SheetPrimitive.Close
        aria-label="Fechar"
        className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/[0.05] text-muted-foreground transition-all hover:bg-white/[0.1] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-90 disabled:pointer-events-none"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-col gap-1.5 border-b border-white/[0.06] px-6 py-6 text-left sm:px-7",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-col-reverse gap-2.5 border-t border-white/[0.06] bg-white/[0.015] px-6 py-5 sm:flex-row sm:justify-end sm:px-7",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
