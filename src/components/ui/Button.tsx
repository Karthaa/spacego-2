"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "teal" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          // Variants
          variant === "primary" &&
            "bg-[#0B132B] text-white hover:bg-[#1C2541] shadow-sm hover:shadow",
          variant === "teal" &&
            "bg-teal-600 text-white hover:bg-teal-700 shadow-sm hover:shadow-teal-600/20 shadow-md",
          variant === "secondary" &&
            "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/80",
          variant === "outline" &&
            "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 shadow-xs",
          variant === "ghost" &&
            "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          variant === "danger" &&
            "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
          // Sizes
          size === "sm" && "text-xs px-3 py-1.5 h-8 gap-1.5",
          size === "md" && "text-sm px-4 py-2.5 h-10 gap-2",
          size === "lg" && "text-base px-6 py-3.5 h-12 gap-2.5 font-semibold",
          size === "icon" && "h-10 w-10 p-0",
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
