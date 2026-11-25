"use client";

import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared field styling: 44px+ height, 16px text (no iOS zoom), token colours. */
export const fieldClasses =
  "w-full rounded-md border border-line-strong bg-surface px-3.5 text-base text-ink " +
  "placeholder:text-ink-subtle transition-colors " +
  "hover:border-slate-400 focus:border-accent focus:outline-none focus-visible:outline-none " +
  "focus:ring-2 focus:ring-ring/40 " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle " +
  "aria-invalid:border-danger aria-invalid:focus:ring-danger/30";

interface FieldChromeProps {
  id: string;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
}

/** Label + control + helper/error text, wired with aria-describedby ids. */
function FieldChrome({ id, label, error, helperText, children }: FieldChromeProps) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${id}-help`} className="text-sm text-ink-muted">
          {helperText}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, helperText?: string): string | undefined {
  if (error) return `${id}-error`;
  if (helperText) return `${id}-help`;
  return undefined;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;

    return (
      <FieldChrome id={inputId} label={label} error={error} helperText={helperText}>
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 flex text-ink-subtle [&_svg]:h-4 [&_svg]:w-4">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, error, helperText)}
            className={cn(fieldClasses, "h-11", leftIcon && "pl-10", rightIcon && "pr-10", className)}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute right-3.5 flex text-ink-subtle [&_svg]:h-4 [&_svg]:w-4">
              {rightIcon}
            </span>
          )}
        </div>
      </FieldChrome>
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, rows = 3, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;

    return (
      <FieldChrome id={inputId} label={label} error={error} helperText={helperText}>
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, error, helperText)}
          className={cn(fieldClasses, "min-h-24 py-2.5 leading-relaxed", className)}
          {...props}
        />
      </FieldChrome>
    );
  }
);

Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, id, children, ...props }, ref) => {
    const autoId = useId();
    const selectId = id || autoId;

    return (
      <FieldChrome id={selectId} label={label} error={error} helperText={helperText}>
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(selectId, error, helperText)}
            className={cn(fieldClasses, "h-11 appearance-none pr-10 cursor-pointer", className)}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          />
        </div>
      </FieldChrome>
    );
  }
);

Select.displayName = "Select";
