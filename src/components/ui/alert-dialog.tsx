import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[90] bg-black/[0.7] backdrop-blur-[8px] duration-200",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

// Modais de confirmação: menores e mais compactos que o Dialog comum, mas
// seguindo o mesmo design system premium (superfície sólida, cantos bem
// arredondados, entrada em fade + escala + leve deslocamento).
const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[91] grid w-[calc(100%-2rem)] max-w-[440px] max-h-[min(88vh,900px)] translate-x-[-50%] translate-y-[-50%] gap-0 overflow-y-auto rounded-[22px] border border-white/[0.08] bg-[oklch(0.13_0.012_255)] p-0 shadow-[0_32px_80px_rgba(0,0,0,0.55),0_8px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150",
        "motion-reduce:transition-none motion-reduce:animate-none",
        "max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:pb-[env(safe-area-inset-bottom)]",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-3 px-6 py-6 text-left sm:px-7", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

// Ícone de alerta em bloco arredondado — some automaticamente pra ações
// não-destrutivas se o chamador não passar `tone="danger"`.
const AlertDialogIcon = ({ tone = "danger" }: { tone?: "danger" | "neutral" }) => (
  <div
    className={cn(
      "grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] border",
      tone === "danger"
        ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
        : "border-primary/20 bg-primary/10 text-primary",
    )}
  >
    <AlertTriangle className="h-5 w-5" />
  </div>
);
AlertDialogIcon.displayName = "AlertDialogIcon";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2.5 border-t border-white/[0.06] bg-white/[0.015] px-6 py-5 sm:flex-row sm:justify-end sm:px-7",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(
      buttonVariants(),
      "h-11 rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_8px_20px_-8px_oklch(0.85_0.22_145/0.5)] transition-all hover:brightness-110 active:scale-[0.98] sm:w-auto",
      className,
    )}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "h-11 rounded-xl border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06] sm:mt-0 sm:w-auto",
      className,
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
