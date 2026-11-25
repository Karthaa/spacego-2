"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { setThemeChoice, useResolvedTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Switches between light and dark; the choice is remembered in localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useResolvedTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setThemeChoice(next)}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink",
        className
      )}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
