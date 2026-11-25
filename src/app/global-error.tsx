"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import "./globals.css";
import { Logo } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/Button";
import { THEME_STORAGE_KEY } from "@/lib/theme-constants";

// Replaces the root layout when it fails, so it renders its own document and
// cannot rely on the app's providers, fonts or theme script.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("SpaceGo: root layout error", error);
  }, [error]);

  useEffect(() => {
    // Re-apply an explicit theme choice; otherwise the CSS follows the OS.
    try {
      const theme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (theme === "light" || theme === "dark") {
        document.documentElement.setAttribute("data-theme", theme);
      }
    } catch {
      // Storage can be unavailable (private mode, blocked site data).
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <title>Something went wrong · SpaceGo</title>
        <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
          <Logo size="md" />
          <div role="alert" className="mt-8 rounded-lg border border-line bg-surface p-6 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">SpaceGo couldn&apos;t load</h1>
            <p className="mt-3 text-base text-ink-muted">
              Something went wrong on our side. Try again, and if it keeps happening, come back in a few
              minutes.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => retry()}
                className={buttonClasses({ variant: "primary", size: "lg" })}
              >
                Try again
              </button>
              {/* A full page load, not client navigation: the app shell itself failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className={buttonClasses({ variant: "outline", size: "lg" })}>
                Go to home page
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
