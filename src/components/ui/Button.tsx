"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "teal"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** "teal" is kept as an alias of "primary" (the single accent). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

/** Shared class builder so links can look like buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none",
    "cursor-pointer transition-[color,background-color,border-color,opacity,box-shadow] duration-150 ease-standard",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    // Hover states are mirrored on :active so touch screens get press feedback.
    (variant === "primary" || variant === "teal") &&
      "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-hover",
    variant === "secondary" &&
      "bg-surface-muted text-ink hover:bg-line active:bg-line",
    variant === "outline" &&
      "border border-line-strong bg-surface text-ink hover:bg-surface-muted active:bg-surface-muted",
    variant === "ghost" &&
      "text-ink-muted hover:bg-surface-muted hover:text-ink active:bg-surface-muted active:text-ink",
    variant === "danger" &&
      "bg-danger-solid text-white hover:bg-danger active:bg-danger",
    // Sizes: 44px targets on touch screens; compact sm on fine pointers.
    size === "sm" && "h-9 px-3.5 text-sm pointer-coarse:h-11",
    size === "md" && "h-11 px-4 text-sm",
    size === "lg" && "h-12 px-6 text-base",
    size === "icon" && "h-11 w-11 p-0",
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={buttonClasses({ variant, size, className })}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
