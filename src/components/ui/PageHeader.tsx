import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Small label above the title (e.g. section name). */
  eyebrow?: string;
  /** Buttons/links shown at the right on wide screens, below on mobile. */
  actions?: React.ReactNode;
  className?: string;
}

/** Standard header for dashboard/owner/admin pages. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-medium text-ink-muted">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-base text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Short explanation of how the number is calculated. */
  hint?: string;
  icon?: React.ReactNode;
}

/** A single real metric. Only use with numbers computed from loaded data. */
export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {icon && <span className="text-ink-subtle [&_svg]:h-5 [&_svg]:w-5" aria-hidden="true">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** Segmented filter tabs (status filters etc.). Scrolls horizontally on small screens. */
export function FilterTabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="group" aria-label={label} className="inline-flex gap-1 rounded-md border border-line bg-surface p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex h-9 items-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
                active ? "bg-surface-muted text-ink" : "text-ink-muted hover:text-ink"
              )}
            >
              {option.label}
              {option.count !== undefined && <span className="text-ink-subtle">{option.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
