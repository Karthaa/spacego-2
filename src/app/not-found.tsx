import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";

// Next.js also adds <meta name="robots" content="noindex"> to this page.
export const metadata: Metadata = {
  title: "Page not found",
};

// buttonClasses() lives in a Client Component module and cannot be called from
// this Server Component, so the primary/outline large button styles are
// spelled out here.
const BUTTON_BASE =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-base font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const PRIMARY = `${BUTTON_BASE} bg-accent text-accent-ink hover:bg-accent-hover`;
const OUTLINE = `${BUTTON_BASE} border border-line-strong bg-surface text-ink hover:bg-surface-muted`;

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16 sm:px-6">
        <div className="w-full rounded-lg border border-line bg-surface px-6 py-12 text-center sm:px-12">
          <p className="text-sm font-semibold text-accent">404</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            We couldn&apos;t find that page
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-ink-muted">
            The link may be out of date, or the page may have moved. You can search all available
            workspaces or head back to the home page.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/spaces" className={PRIMARY}>
              Browse spaces
            </Link>
            <Link href="/" className={OUTLINE}>
              Go to home page
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
