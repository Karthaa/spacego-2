import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SpaceGoDataProvider } from "@/context/SpaceGoDataProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { THEME_STORAGE_KEY } from "@/lib/theme-constants";
import { isTestSite, siteUrl } from "@/lib/site";
import { TestSiteBanner } from "@/components/navigation/TestSiteBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display serif for marketing headlines and listing titles (font-display).
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const SITE_NAME = "SpaceGo";
const SITE_TITLE = "SpaceGo · Find and book flexible workspaces";
const SITE_DESCRIPTION =
  "Find the right space. Search coworking desks, private offices, meeting rooms and studios, request a booking, and get confirmed by the host.";

// Icons and the default share image come from the app/favicon.ico,
// app/icon.svg, app/apple-icon.tsx and app/opengraph-image.tsx file
// conventions, so they are not repeated here.
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  // The test site carries demo listings: keep it out of search engines.
  ...(isTestSite() ? { robots: { index: false, follow: false } } : {}),
  title: {
    template: "%s · SpaceGo",
    default: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e0d" },
  ],
};

// Runs before first paint so a stored theme choice never flashes. Without a
// stored choice the CSS follows prefers-color-scheme.
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink selection:bg-accent selection:text-accent-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-line-strong focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-ink focus:shadow-md"
        >
          Skip to content
        </a>
        <TestSiteBanner />
        <AuthProvider>
          <SpaceGoDataProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SpaceGoDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
