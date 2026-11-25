"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button, buttonClasses } from "@/components/ui/Button";

function errorDigest(error: unknown): string | null {
  if (error instanceof Error && "digest" in error) {
    const digest = (error as Error & { digest?: unknown }).digest;
    return typeof digest === "string" && digest ? digest : null;
  }
  return null;
}

// Not named `Error`: that would shadow the global Error used in errorDigest().
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("SpaceGo: unhandled error", error);
  }, [error]);

  const digest = errorDigest(error);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center rounded-md" aria-label="SpaceGo home">
            <Logo size="md" />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16 sm:px-6">
        <div
          role="alert"
          className="w-full rounded-lg border border-line bg-surface px-6 py-12 text-center sm:px-12"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Something went wrong</h1>
          <p className="mx-auto mt-3 max-w-md text-base text-ink-muted">
            This page didn&apos;t load properly. Your bookings and saved spaces are safe. Try again, or
            go back to the home page.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => retry()}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Link href="/" className={buttonClasses({ variant: "outline", size: "lg" })}>
              Go to home page
            </Link>
          </div>
          {digest && <p className="mt-6 text-xs text-ink-subtle">Reference: {digest}</p>}
        </div>
      </main>
    </div>
  );
}
