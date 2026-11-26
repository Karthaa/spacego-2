import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Home section header: display-serif title, one muted line, optional link right. */
export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        )}
        <h2 id={id} className={cn("font-display text-4xl leading-tight text-ink sm:text-5xl", eyebrow && "mt-2")}>
          {title}
        </h2>
        {description && <p className="mt-3 text-base text-ink-muted sm:text-lg">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-full text-sm font-semibold text-ink underline-offset-4 hover:underline sm:self-auto"
        >
          {action.label}
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
