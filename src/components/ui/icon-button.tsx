"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  /** Accessible name, also shown as the tooltip. */
  label: string;
  icon: React.ReactNode;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

/**
 * Square icon-only button with a tooltip. Forwards its ref and props, so it can
 * be the child of an `asChild` trigger (e.g. DialogTrigger).
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, tooltipSide = "top", className, variant = "outline", ...props }, ref) => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            size="sm"
            variant={variant}
            aria-label={label}
            className={cn("h-9 w-9 shrink-0 p-0", className)}
            {...props}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
);
IconButton.displayName = "IconButton";
