"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[80] bg-black/[0.66] backdrop-blur-[8px] duration-200",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

// Design system global de modais (padrão "iOS premium"): superfície
// grafite sólida, cantos bem arredondados, sombra ampla e difusa, brilho
// interno sutil no topo, entrada em fade + leve escala + deslocamento
// vertical curto. Qualquer tela que use <DialogContent> herda isso
// automaticamente — não é preciso reescrever cada modal individualmente.
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[81] grid w-[calc(100%-2rem)] max-w-[600px] max-h-[min(88vh,900px)] translate-x-[-50%] translate-y-[-50%] gap-0 overflow-y-auto rounded-[24px] border border-white/[0.08] bg-[oklch(0.13_0.012_255)] p-0 shadow-[0_32px_80px_rgba(0,0,0,0.55),0_8px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150",
        "motion-reduce:transition-none motion-reduce:animate-none",
        // Mobile: vira folha de baixo pra cima, cantos só no topo, tela cheia disponível.
        "max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:pb-[env(safe-area-inset-bottom)] max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=open]:zoom-in-100",
        className,
      )}
      {...props}
    >
      {/* Alça de arraste — só decorativa, só aparece no formato sheet mobile. */}
      <div
        aria-hidden
        className="mx-auto mt-2.5 hidden h-1 w-[38px] shrink-0 rounded-full bg-white/15 max-sm:block"
      />
      {children}
      <DialogPrimitive.Close
        aria-label="Fechar"
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/[0.05] text-muted-foreground transition-all hover:bg-white/[0.1] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-90 disabled:pointer-events-none"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1.5 border-b border-white/[0.06] px-6 py-6 text-left sm:px-7",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2.5 border-t border-white/[0.06] bg-white/[0.015] px-6 py-5 sm:flex-row sm:justify-end sm:px-7",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

// Corpo rolável do modal, com o respiro interno pedido no design system
// (24-28px desktop, 18-20px mobile). Uso opcional — quem não usar continua
// funcionando, só sem esse padding padronizado.
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-4 px-6 py-6 sm:px-7", className)} {...props} />
);
DialogBody.displayName = "DialogBody";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogBody,
};
