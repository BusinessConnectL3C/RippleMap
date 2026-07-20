import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand text-white",
        secondary: "border-transparent bg-neutral-100 text-text-secondary",
        destructive: "border-transparent bg-danger-subtle text-[var(--danger)]",
        outline: "border-border-strong text-text-secondary",
        brand: "border-transparent bg-brand-subtle text-[var(--text-brand)]",
        accent: "border-transparent bg-accent-subtle text-[var(--yellow-500)]",
        success: "border-transparent bg-[var(--success-subtle)] text-[var(--success)]",
        warning: "border-transparent bg-[var(--warning-subtle)] text-[var(--yellow-500)]",
        info: "border-transparent bg-[var(--info-subtle)] text-[var(--info)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
