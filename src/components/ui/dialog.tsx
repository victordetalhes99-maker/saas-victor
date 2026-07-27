"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Lock } from "lucide-react";

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
      "fixed inset-0 z-[80] bg-[radial-gradient(circle_at_30%_22%,oklch(0.85_0.22_145/0.10),transparent_30%),rgba(2,4,5,0.82)] backdrop-blur-[18px] duration-200",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

// Design system global de modais (padrão "premium referência"): superfície
// grafite sólida com halo verde difuso nos cantos, cantos bem arredondados
// (32px), sombra profunda, entrada em fade + escala + deslocamento vertical.
// Qualquer tela que use <DialogContent> herda isso automaticamente.
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[81] flex w-[calc(100%-2.5rem)] max-w-[700px] max-h-[calc(100dvh-40px)] flex-col translate-x-[-50%] translate-y-[-50%] gap-0 overflow-y-auto rounded-[32px] border border-white/[0.14] p-0 duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        "bg-[radial-gradient(circle_at_88%_92%,oklch(0.85_0.22_145/0.12),transparent_30%),radial-gradient(circle_at_12%_4%,oklch(1_0_0/0.045),transparent_26%),linear-gradient(145deg,oklch(0.14_0.012_255/0.995),oklch(0.08_0.01_255/0.995))]",
        "shadow-[0_60px_160px_rgba(0,0,0,0.84),0_20px_60px_rgba(0,0,0,0.56),0_0_90px_oklch(0.85_0.22_145/0.055),inset_0_1px_0_rgba(255,255,255,0.07)]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150",
        "motion-reduce:transition-none motion-reduce:animate-none",
        // Mobile: vira folha de baixo pra cima, cantos só no topo, tela cheia disponível.
        "max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-full max-sm:max-h-[94dvh] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[32px] max-sm:pb-[env(safe-area-inset-bottom)] max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=open]:zoom-in-100",
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
        className="group absolute right-6 top-6 z-10 grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-muted-foreground shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all hover:rotate-3 hover:bg-white/[0.1] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-90 disabled:pointer-events-none"
      >
        <X className="h-5 w-5" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex shrink-0 flex-col gap-1.5 px-8 pb-6 pt-[34px] text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

// Cabeçalho com ícone circular iluminado, no padrão exato da referência
// (círculo de 72px, verde radial, glow suave). Uso opcional — passe
// `icon` e o resto da estrutura de título/descrição continua livre.
const DialogIconHeader = ({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: React.ElementType;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex shrink-0 items-start gap-4 px-8 pb-6 pt-[34px] pr-20", className)}>
    <span
      className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full border border-primary/40 text-primary shadow-[0_0_34px_oklch(0.85_0.22_145/0.2),inset_0_1px_0_rgba(255,255,255,0.14)]"
      style={{
        background:
          "radial-gradient(circle at 35% 30%, oklch(0.9 0.25 145 / 0.28), oklch(0.35 0.1 155 / 0.62))",
      }}
    >
      <Icon className="h-8 w-8" />
    </span>
    <div className="min-w-0 pt-1.5">
      <h2 className="text-[27px] font-bold leading-tight tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      {description && <p className="mt-1 text-[15px] text-white/[0.63]">{description}</p>}
    </div>
  </div>
);
DialogIconHeader.displayName = "DialogIconHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "grid shrink-0 grid-cols-1 gap-4 border-t border-white/[0.08] bg-white/[0.012] px-8 py-[22px] sm:grid-cols-[1fr_1.15fr]",
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
    className={cn(
      "text-[27px] font-bold leading-tight tracking-[-0.02em] text-foreground",
      className,
    )}
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
    className={cn("mt-1 text-[15px] text-white/[0.63]", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

// Corpo rolável do modal, com o respiro pedido na referência (grid com
// gap de 24px, padding lateral de 38px).
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "grid min-h-0 flex-1 auto-rows-min gap-6 overflow-y-auto px-8 pb-[30px]",
      className,
    )}
    {...props}
  />
);
DialogBody.displayName = "DialogBody";

// Cápsula "Seguro, privado e protegido" — só para modais de criação,
// pagamento, plano, assinatura, convite ou configurações críticas.
const DialogSecurityBadge = ({ label = "Seguro, privado e protegido" }: { label?: string }) => (
  <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-[oklch(0.12_0.012_255/0.8)] px-4 py-2 text-xs text-white/60 shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
    <Lock className="h-3.5 w-3.5 text-primary" />
    {label}
  </div>
);
DialogSecurityBadge.displayName = "DialogSecurityBadge";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogIconHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogSecurityBadge,
};
