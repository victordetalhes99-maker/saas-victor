import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type SimplePageAction = {
  label: string;
  to: string;
  variant?: "primary" | "secondary";
};

export function SimplePage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: SimplePageAction[];
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center px-4 py-12">
      <div className="space-y-6 rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[var(--shadow-float)]">
        <div className="space-y-2">
          {eyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary/80">
              {eyebrow}
            </p>
          )}
          <h1 className="text-display text-3xl tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>

        {children}

        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={`${action.to}:${action.label}`}
                to={action.to}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition ${
                  action.variant === "secondary"
                    ? "border border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
